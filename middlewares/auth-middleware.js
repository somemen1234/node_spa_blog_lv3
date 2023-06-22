const jwt = require("jsonwebtoken");
const { Users } = require("../models");

module.exports = async (req, res, next) => {
  try {
    const { Authorization } = req.cookies;

    const [authType, authToken] = (Authorization ?? "").split(" ");

    if (authType !== "Bearer" || !authToken) {
      res.status(403).json({
        success: false,
        errorMessage: "로그인 후에 이용할 수 있는 기능입니다.",
      });
      return;
    }

    const { userId } = jwt.verify(authToken, "secret-login-key");

    const user = await Users.findOne({ where: { userId } });

    if (!user) {
      res.clearCookie("Authorization");
      res.status(403).json({ success: false, errorMessage: "토큰 사용자가 존재하지 않습니다." });
    }

    res.locals.user = user;
    res.locals.userNickname = user.nickname;

    next();
  } catch (error) {
    res.clearCookie("Authorization");
    res.status(403).json({
      success: false,
      errorMessage: "전달된 쿠키에서 오류가 발생하였습니다.",
    });
    return;
  }
};
