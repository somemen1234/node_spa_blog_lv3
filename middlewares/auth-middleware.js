const jwt = require("jsonwebtoken");
const { Users, Tokens } = require("../models");

module.exports = async (req, res, next) => {
  try {
    const existReFreshToken = await Tokens.findOne({});
    const { accessToken } = req.cookies;
    const [accessAuthType, accessAuthToken] = (accessToken ?? "").split(" ");

    // 1) accessToken과 refreshToken이 둘다 없을때
    if (accessAuthType !== "Bearer" && !accessAuthToken && !existReFreshToken) {
      res.status(403).json({
        success: false,
        errorMessage: "로그인 후에 이용할 수 있는 기능입니다.",
      });
      return;
    }

    // 2) refreshToken만 있을 때
    if (existReFreshToken.tokenId.length !== 0 && !accessAuthType && !accessAuthToken) {
      const accessToken = jwt.sign(
        { userId: existReFreshToken.UserId },
        process.env.JWT_SECRET_KEY,
        {
          expiresIn: "1h",
        }
      );

      res.cookie("accessToken", `Bearer ${accessToken}`);
      const { userId } = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
      const user = await Users.findOne({ where: { userId } });

      if (!user) {
        res.clearCookie("accessToken");
        res.status(403).json({ success: false, errorMessage: "토큰 사용자가 존재하지 않습니다." });
      }

      res.locals.user = user;
      res.locals.userNickname = user.nickname;
      next();
    } else {
      // 4) 둘 다 있을 때
      const { userId } = jwt.verify(accessAuthToken, process.env.JWT_SECRET_KEY);
      const user = await Users.findOne({ where: { userId } });

      if (!user) {
        res.clearCookie("accessToken");
        res.status(403).json({ success: false, errorMessage: "토큰 사용자가 존재하지 않습니다." });
      }

      res.locals.user = user;
      res.locals.userNickname = user.nickname;

      next();
    }
  } catch (error) {
    res.clearCookie("accessToken");
    Tokens.destroy({});
    res.status(403).json({
      success: false,
      errorMessage: "전달된 쿠키에서 오류가 발생하였습니다.",
    });
    return;
  }
};
