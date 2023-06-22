const express = require("express");
const { Users } = require("../models");
const jwt = require("jsonwebtoken");
const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { nickname, password, confirmPassword } = req.body;
    const existUser = await Users.findOne({ where: { nickname } });
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

    const token = jwt.sign({ userId: user.userId }, "secret-login-key", { expiresIn: "1h" });
    res.cookie("Authorization", `Bearer ${token}`);
    return res.status(200).json({ success: true, token });
  } catch (error) {
    return res.status(400).json({ success: false, errorMessage: "로그인에 실패하였습니다." });
  }
});

module.exports = router;
