# node_spa_blog_lv3

회원가입과 로그인을 통한 내 블로그 백엔드 서버 구현(게시판)
/ mongoose가 아닌 MYSQL을 sequelize로 구현(RDS)


accessToken / refreshToken

- 쿠키에 저장할 accessToken과 db에 저장해서 사용할 refreshToken 두개를 발급받아 사용하도록 구현
- accessToken은 만료기간을 1시간으로 정했고 refreshToken은 만료기간을 14일로 정함
- 최초 로그인 시, 두 개가 동시에 생성이 되며 refreshToken이 만료되지 않는 이상 accessToken이
  - 삭제되거나 만료기간을 넘기게 되더라도 refreshToken을 검증해 검증이 완료되면 새 accessToken이 발급되도록 구현
- 처음에는 한 사용자만의 refreshToken을 저장하는 방식으로 구현을 했었고 (로그인 유지만 가능하도록)
  - 이후 여러 사용자가 로그인을 해서 로그아웃 하지 않는 이상 사용자 계정 전환을 할 수 있도록 구현
- refreshToken이 만료되었을 때, accessToken이 만료되지 않았다면 그대로 사용이 가능하고
  - 만일, accessToken도 만료가 되었다면 새로 로그인하라는 오류를 반환하면서 만료된 토큰을 삭제함


users.route(회원가입)

- 닉네임과 비밀번호, 비밀번호 확인을 입력해서 간단하게 가입할 수 있도록 구현
- 닉네임은 정규형을 통해 3~12자리의 숫자와 문자로만 구성이 가능하도록 유효성 검사
- 비밀번호는 4자리 이상이고 닉네임과 동일한 값이 포함이 되면 안되도록 설정
- 이미 존재하는 닉네임이면 가입이 되지 않도록 설정


users.route(로그인)

- MYSQL에 저장이 된 닉네임과 비밀번호가 일치할 경우 로그인이 되도록 구현


users.route(로그아웃)

- userId를 params로 전달 받아 해당 유저가 refreshToken에 존재를 한다면 refreshToken과 쿠키를 전부 삭제함
- 이 때, refreshToken에 다른 사용자의 정보가 담겨있다면 가장 마지막에 로그인한 사용자로 로그인이 전환됨
  - 만일 가장 마지막 로그인 사용자의 refreshToken이 만료가 되었다면 로그인이 유지되는 사용자는 그 다음 사용자로 바뀌게 됨. 앞을 반복하고 맨 마지막에 로그인한 사용자마저 refreshToken 유효기간이 만료가 되었다면 로그인 후 이용해주세요 오류를 반환
- userId에 해당하는 refreshToken이 존재하지 않다면 로그인 되어 있지 않은 아이디입니다를 반환


users.route(사용자 계정 전환)

- userId를 params로 전달 받아 해당 유저가 회원가입이 되어 있는지를 먼저 확인하고 그 후 해당 userId로 저장된
  - refreshToken을 찾아보고 없으면 로그인 먼저 해달라는 오류 반환, 있다면 해당 토큰을 검증을 해 만료가 되었다면 다시 로그인하라는 오류 반환, 만료가 되지 않았다면 해당 아이디로 새 accessToken을 만들어 로그인


posts(게시글)

- 게시글 등록은 현재 accessToken을 검증하고 검증이 완료되었다면 현재 로그인된 정보를 같이 게시글db에 저장함
- 게시글 전체조회는 모든 게시글을 생성 역순 즉, 가장 최근에 생성된 순서로 보여지도록 구현
- 게시글 상세조회는 postId를 받아 해당 아이디로 된 게시글이 DB에 있다면 가져와 내용까지 전부 보여지게 구현
- 게시글 수정은 현재 로그인된 토큰을 검증해서 검증이 완료되면 수정을 할 수 있도록 구현, 만일 작성한 userId와
  - 현재 로그인된 userId가 다르다면 수정할 수 없도록 권한 막음 & 게시글 내용이 없으면 수정을 못하도록 구현
- 게시글 삭제 또한 로그인된 토큰을 검증 해 검증된 사람 중 해당 게시글을 작성한 사람만 삭제를 할 수 있게 구현

ERD : ![drawSQL-spa-blog-lv3-export-2023-06-23](https://github.com/somemen1234/node_spa_blog_lv3/assets/28723327/9737845e-d834-497d-ba37-b6c0d2287e0a)


상세 API https://charming-castanet-ba9.notion.site/4169e1aada0b415bbbb4a6f2be6d8c19?v=1f5fde412ed047eebbd7d8c36e18787c&pvs=4
