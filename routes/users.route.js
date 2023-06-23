const express = require("express");
const { Users, Tokens } = require("../models");
const jwt = require("jsonwebtoken");
const router = express.Router();

// 회원가입 API
router.post("/signup", async (req, res) => {
  try {
    const { nickname, password, confirmPassword } = req.body;
    let nicknameReg = new RegExp(/^[\w]{3,12}$/g);

    if (!nickname || !password || !confirmPassword) {
      res.status(412).json({
        success: false,
        errorMessage: "닉네임, 비밀번호, 비밀번호 확인을 전부 입력해주세요.",
      });
      return;
    }

    // 정규형을 통해 비교
    if (!nicknameReg.test(nickname)) {
      res.status(412).json({
        success: false,
        errorMessage: "닉네임은 3 ~ 12자리이면서 알파벳이나 숫자로만 구성해주세요.",
      });
      return;
    }

    if (password.length < 4 || password.includes(nickname)) {
      res.status(412).json({
        success: false,
        errorMessage: "패스워드는 4자리이상이고 닉네임과 같은 값이 포함이 되면 안됩니다.",
      });
      return;
    }

    if (password !== confirmPassword) {
      res.status(412).json({
        success: false,
        errorMessage: "패스워드와 패스워드확인이 다릅니다.",
      });
      return;
    }
    const existUser = await Users.findOne({ where: { nickname } });

    if (existUser) {
      res.status(412).json({
        success: false,
        errorMessage: "이미 존재하는 닉네임입니다.",
      });
      return;
    }

    await Users.create({ nickname, password });

    return res.status(201).json({ success: true, message: "회원 가입에 성공하였습니다." });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, errorMessage: "요청한 데이터 형식이 올바르지 않습니다." });
  }
});

// 로그인 API
router.post("/login", async (req, res) => {
  try {
    const { nickname, password } = req.body;

    if (!nickname || !password)
      return res.status(412).json({ errorMessage: "닉네임 또는 패스워드를 입력해주세요." });

    const user = await Users.findOne({ where: { nickname } });

    // 저장된 DB에 해당하는 user정보가 없는 경우
    if (!user || user.password !== password)
      return res.status(412).json({ errorMessage: "닉네임 또는 패스워드를 확인해주세요." });

    // 저장된 user의 refreshToken이 있는지 확인
    const existReFreshToken = await Tokens.findOne({ where: { UserId: user.userId } });

    // 없으면 accessToken과 refreshToken을 모두 생성
    if (!existReFreshToken) {
      const refreshToken = jwt.sign({}, process.env.JWT_SECRET_KEY, { expiresIn: "14d" });
      const accessToken = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      await Tokens.create({ tokenId: refreshToken, UserId: user.userId });
      res.cookie("accessToken", `Bearer ${accessToken}`);
      return res
        .status(200)
        .json({ success: true, message: "로그인에 성공했습니다.", accessToken });
    }

    // refreshToken이 있다면 검증을 실시
    // 검증이 성공이 된다면 accessToken만 새로 발급하고 refreshToken은 그대로 가져옴
    // 이 때, 기존에 있는 값을 지우고 새로 생성하는 이유는 Tokens에 여러 계정이 들어가기 때문에
    // 계정이 의도치않게 삭제되거나 로그아웃 되었을 때 가장 마지막에 로그인한 사용자의 정보가
    // 자동으로 로그인 되도록 설정하기 위해서 기존에 Tokens에 있는 값을 지우고 새로 생성
    // refreshToken은 그대로 가져오기에 만료기간은 갱신되지 않음
    jwt.verify(existReFreshToken.tokenId, process.env.JWT_SECRET_KEY);

    await Tokens.destroy({ where: { UserId: user.userId } });
    await Tokens.create({ tokenId: existReFreshToken.tokenId, UserId: user.userId });

    const accessToken = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET_KEY, {
      expiresIn: "1h",
    });

    res.cookie("accessToken", `Bearer ${accessToken}`);
    return res.status(200).json({ success: true, message: "로그인에 성공했습니다.", accessToken });
  } catch (error) {
    // refreshToken이 만료되었을 경우
    // 두 토큰을 전부 생성
    if (error.name === "TokenExpiredError") {
      const refreshToken = jwt.sign({}, process.env.JWT_SECRET_KEY, { expiresIn: "14d" });
      const accessToken = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      await Tokens.destroy({ where: { UserId: user.userId } });
      await Tokens.create({ tokenId: refreshToken, UserId: user.userId });
      res.cookie("accessToken", `Bearer ${accessToken}`);
      return res
        .status(200)
        .json({ success: true, message: "로그인에 성공했습니다.", accessToken });
    }
    console.log(error);
    return res.status(400).json({ success: false, errorMessage: "로그인에 실패하였습니다." });
  }
});

// 로그아웃 API
// 해당 유저의 토큰 값이 있는지 비교해서 있으면 삭제하고 없으면 로그인이 되어 있지 않다고 출력
router.delete("/logout/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await Users.findOne({ where: { userId } });
    const existToken = await Tokens.findOne({ where: { UserId: userId } });

    if (!existToken) {
      return res.status(404).json({
        success: false,
        errorMessage: "로그인이 되어 있지 않은 아이디입니다.",
      });
    }

    await Tokens.destroy({ where: { UserId: userId } });
    res.clearCookie("accessToken");

    return res
      .status(200)
      .json({ success: true, message: `${user.nickname}님이 로그아웃 되었습니다.` });
  } catch (error) {
    return res.status(400).json({ success: false, errorMessage: "로그아웃에 실패하였습니다" });
  }
});

// 사용자 계정 전환 API
router.post("/switchId/:userId", async (req, res) => {
  const { userId } = req.params;
  const currentUserId = await Users.findOne({ where: { userId } });

  try {
    if (!currentUserId) {
      return res.status(404).json({
        success: false,
        errorMessage: "회원가입이 되어 있지 않은 아이디입니다. 회원가입 해주세요.",
      });
    }

    // 해당 유저의 refreshToken을 가져와 검증함
    // 검증에 성공하면 해당 유저를 로그인 상태로 바꾸고 refreshToken을 삭제하고 재생성해서 제일 상단에 위치하게 함
    const existReFreshToken = await Tokens.findOne({ where: { UserId: currentUserId.userId } });
    jwt.verify(existReFreshToken.tokenId, process.env.JWT_SECRET_KEY);

    await Tokens.destroy({ where: { UserId: currentUserId.userId } });
    await Tokens.create({ tokenId: existReFreshToken.tokenId, UserId: currentUserId.userId });

    const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
      expiresIn: "1h",
    });
    res.cookie("accessToken", `Bearer ${accessToken}`);
    return res
      .status(200)
      .json({ success: true, message: `${currentUserId.nickname}님의 계정으로 전환되었습니다.` });
  } catch (error) {
    // 토큰이 검증 실패했으면 만료된 아이디라는 오류 반환
    if (error.name === "TokenExpiredError") {
      await Tokens.destroy({ where: { UserId: userId } });
      return res.status(403).json({
        success: false,
        message: "토큰이 만료된 아이디입니다. 다시 로그인 해주세요.",
      });
    }
    // 토큰이 존재하지 않았을 경우에 여기로 들어가서 로그인 먼저 해달라는 오류 반환
    console.log(error);
    return res.status(403).json({
      success: false,
      errorMessage: "계정 전환에 실패했습니다. 로그인 먼저 해주세요.",
    });
  }
});

module.exports = router;
