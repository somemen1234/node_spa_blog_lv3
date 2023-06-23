const express = require("express");
const { Posts } = require("../models");
const { Op } = require("sequelize");
const authMiddleware = require("../middlewares/auth-middleware.js");
const router = express.Router();

//게시글 등록 API
router.post("/posts", authMiddleware, async (req, res) => {
  try {
    const { userId } = res.locals.user;
    const nickname = res.locals.userNickname;
    const { title, content } = req.body;

    if (!title || !content)
      return res
        .status(412)
        .json({ success: false, errorMessage: "게시글의 정보가 입력되지 않았습니다." });

    //DB에 데이터가 비어있다면 AUTO_INCREMENT를 1로 초기화 하는 방법(쿼리문에서) => 좋은 action이 아님(시말서 각)
    //ALTER TABLE table_name AUTO_INCREMENT = 1;
    const post = await Posts.create({
      UserId: userId,
      Nickname: nickname,
      title,
      content,
    });

    return res.json({ success: true, message: "게시글을 생성하였습니다." });
  } catch (error) {
    return res.status(400).json({ success: false, errorMessage: "게시글 작성에 실패했습니다." });
  }
});

//게시글 전제 조회 API
router.get("/posts", async (_, res) => {
  try {
    const posts = await Posts.findAll({
      attributes: ["postId", "UserId", "Nickname", "title", "createdAt", "updatedAt"],
      order: [["createdAt", "DESC"]],
    });
    if (!posts.length)
      return res.status(404).json({ success: false, errorMessage: "작성된 게시글이 없습니다." });

    return res.status(200).json({ success: true, posts: posts });
  } catch (error) {
    return res.status(400).json({ success: false, errorMessage: "게시글 조회에 실패하였습니다." });
  }
});

//게시글 상세조회 API
router.get("/posts/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Posts.findOne({
      attributes: ["postId", "UserId", "Nickname", "title", "content", "createdAt", "updatedAt"],
      where: { postId },
    });

    if (!post)
      return res
        .status(404)
        .json({ success: false, errorMessage: "해당 게시글을 찾을 수 없습니다." });

    return res.status(200).json({ post: post });
  } catch (error) {
    return res.status(400).json({ success: false, errorMessage: "게시글 조회에 실패했습니다." });
  }
});

//게시글 수정 API
router.put("/posts/:postId", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = res.locals.user;
    const { title, content } = req.body;

    const existPost = await Posts.findOne({ where: { postId } });
    if (!existPost)
      return res
        .status(404)
        .json({ success: false, errorMessage: "해당 게시글을 찾을 수 없습니다." });

    if (userId !== existPost.UserId)
      return res
        .status(403)
        .json({ success: false, errorMessage: "게시글 수정 권한이 존재하지 않습니다." });

    if (!title || !content)
      return res
        .status(412)
        .json({ success: false, errorMessage: "게시글 제목이나 내용이 빈 내용인지 확인해 주세요" });

    await Posts.update(
      { title, content },
      {
        where: {
          [Op.and]: [{ postId }, { UserId: userId }],
        },
      }
    );

    return res.status(201).json({ success: true, message: "게시글을 수정하였습니다." });
  } catch (error) {
    return res.status(400).json({ success: false, errorMessage: "게시글 수정에 실패했습니다." });
  }
});

//게시글 삭제 API
router.delete("/posts/:postId", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = res.locals.user;

    const existPost = await Posts.findOne({ where: { postId } });

    if (!existPost)
      return res
        .status(404)
        .json({ success: false, errorMessage: "해당 게시글을 찾을 수 없습니다." });

    if (userId !== existPost.UserId)
      return res
        .status(403)
        .json({ success: false, errorMessage: "게시글 삭제 권한이 존재하지 않습니다." });

    await Posts.destroy({
      where: {
        [Op.and]: [{ postId }, { UserId: userId }],
      },
    });
    return res.status(200).json({ success: true, message: "게시글을 삭제하였습니다." });
  } catch (error) {
    return res.status(400).json({ success: false, errorMessage: "게시글 삭제에 실패했습니다." });
  }
});

module.exports = router;
