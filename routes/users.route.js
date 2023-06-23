const express = require("express");
const { Users, Tokens, Posts } = require("../models");
const jwt = require("jsonwebtoken");
const router = express.Router();

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

router.post("/login", async (req, res) => {
  try {
    const { nickname, password } = req.body;
    const user = await Users.findOne({ where: { nickname } });

    if (!user || user.password !== password)
      return res.status(412).json({ errorMessage: "닉네임 또는 패스워드를 확인해주세요." });

    const existReFreshToken = await Tokens.findOne({ where: { UserId: user.userId } });

    if (!existReFreshToken) {
      const refreshToken = jwt.sign({}, process.env.JWT_SECRET_KEY, { expiresIn: "14d" });
      const accessToken = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      await Tokens.create({ tokenId: refreshToken, UserId: user.userId });
      res.cookie("accessToken", `Bearer ${accessToken}`);
      return res.status(200).json({ success: true, accessToken });
    }
    try {
      jwt.verify(existReFreshToken.tokenId, process.env.JWT_SECRET_KEY);

      await Tokens.destroy({ where: { UserId: user.userId } });
      await Tokens.create({ tokenId: existReFreshToken.tokenId, UserId: user.userId });

      const accessToken = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      res.cookie("accessToken", `Bearer ${accessToken}`);
      return res.status(200).json({ success: true, accessToken });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        const refreshToken = jwt.sign({}, process.env.JWT_SECRET_KEY, { expiresIn: "14d" });
        const accessToken = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET_KEY, {
          expiresIn: "1h",
        });

        await Tokens.destroy({ where: { UserId: user.userId } });
        await Tokens.create({ tokenId: refreshToken, UserId: user.userId });
        res.cookie("accessToken", `Bearer ${accessToken}`);
        return res.status(200).json({ success: true, accessToken });
      } else throw Error;
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, errorMessage: "로그인에 실패하였습니다." });
  }
});

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

router.post("/switchId/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = await Users.findOne({ where: { userId } });

    if (!currentUserId) {
      return res.status(404).json({
        success: false,
        errorMessage: "회원가입이 되어 있지 않은 아이디입니다. 회원가입 해주세요.",
      });
    }
    const existReFreshToken = await Tokens.findOne({ where: { UserId: currentUserId.userId } });
    try {
      jwt.verify(existReFreshToken.tokenId, process.env.JWT_SECRET_KEY);

      await Tokens.destroy({ where: { UserId: currentUserId.userId } });
      await Tokens.create({ tokenId: existReFreshToken.tokenId, UserId: currentUserId.userId });

      const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });
      res.cookie("accessToken", `Bearer ${accessToken}`);
      return res
        .status(200)
        .json({ success: true, message: `${currentUserId.nickname}의 계정으로 전환되었습니다.` });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        await Tokens.destroy({ where: { tokenId: existReFreshToken.tokenId } });
        return res.status(400).json({
          success: false,
          message: "토큰이 만료된 아이디입니다. 다시 로그인 해주세요.",
        });
      } else throw Error;
    }
  } catch (error) {
    console.log(error);
    return res.status(403).json({
      success: false,
      errorMessage: "계정 전환에 실패했습니다. 로그인 먼저 해주세요",
    });
  }
});

module.exports = router;
