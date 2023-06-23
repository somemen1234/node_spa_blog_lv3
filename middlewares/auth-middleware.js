const jwt = require("jsonwebtoken");
const { Users, Tokens } = require("../models");

module.exports = async (req, res, next) => {
  const existReFreshToken = await Tokens.findOne({ order: [["createdAt", "DESC"]] });
  const { accessToken } = req.cookies;
  const [accessAuthType, accessAuthToken] = (accessToken ?? "").split(" ");
  try {
    // 1) accessToken과 refreshToken이 둘다 없을때
    if (accessAuthType !== "Bearer" && !accessAuthToken && !existReFreshToken) {
      res.status(403).json({
        success: false,
        errorMessage: "로그인 후에 이용할 수 있는 기능입니다.",
      });
      return;
    }

    // 2) refreshToken들만 있을 때
    if (existReFreshToken.tokenId.length !== 0 && !accessAuthType && !accessAuthToken) {
      jwt.verify(existReFreshToken.tokenId, process.env.JWT_SECRET_KEY);

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
      try {
        // 3)
        const { userId } = jwt.verify(accessAuthToken, process.env.JWT_SECRET_KEY);
        const user = await Users.findOne({ where: { userId } });

        if (!user) {
          res.clearCookie("accessToken");
          res
            .status(403)
            .json({ success: false, errorMessage: "토큰 사용자가 존재하지 않습니다." });
        }

        res.locals.user = user;
        res.locals.userNickname = user.nickname;

        next();
      } catch (error) {
        // 둘 다 있는데 accessToken만 만료
        if (error.name === "TokenExpiredError") {
          jwt.verify(existReFreshToken.tokenId, process.env.JWT_SECRET_KEY);

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
            res
              .status(403)
              .json({ success: false, errorMessage: "토큰 사용자가 존재하지 않습니다." });
          }

          res.locals.user = user;
          res.locals.userNickname = user.nickname;
          next();
        }
      }
    }
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      if (existReFreshToken) {
        await Tokens.destroy({ where: { tokenId: existReFreshToken.tokenId } });
      }
      res.status(403).json({
        success: false,
        message: "토큰이 만료된 아이디입니다. 다시 로그인 해주세요.",
      });
      return;
    } else {
      res.clearCookie("accessToken");
      Tokens.destroy({ where: {} });
      res.status(403).json({
        success: false,
        errorMessage: "전달된 쿠키에서 오류가 발생하였습니다. 모든 쿠키를 삭제합니다.",
      });
      return;
    }
  }
};
