![module info](https://nodei.co/npm/mysqli.png?downloads=true&downloadRank=true&stars=true)

# mysqli

> 本模块基于 node-mysql 模块二次封装，将 SQL 语法转为类似 MongoDB 的 API。对常用的增删改查提供了简单的 API, 并且进行了 SQL 注入过滤, 对新手非常友好。

## 使用 npm 安装

```bash
# 3.x 版的安装
npm i mysqli
# or
npm i mysqli@3.x


# 2.x 旧版的安装
npm i mysqli@2.x
```

## 实例化

> 实例化可以传入一个数组,或单个 object 配置。只有一个数据库时，默认是主库 ; 多于 1 个数据库服务时，自动以第 1 个为主库，其他的从库，故实例化时，`注意顺序`。

```javascript
let Mysqli = require('mysqli')

//传入json
let conn = new Mysqli({
  host: '', // IP/域名
  post: 3306, //端口， 默认 3306
  user: '', //用户名
  passwd: '', //密码
  charset: '', // 数据库编码，默认 utf8 【可选】
  db: '' // 可指定数据库，也可以不指定 【可选】
})

// 传入数组
let conn = new Mysqli([
  {
    host: 'host1', // IP/域名
    post: 3306, //端口， 默认 3306
    user: '', //用户名
    passwd: '', //密码
    charset: '', // 数据库编码，默认 utf8 【可选】
    db: '' // 可指定数据库，也可以不指定 【可选】
  },
  {
    host: 'host2', // IP/域名
    post: 3306, //端口， 默认 3306
    user: '', //用户名
    passwd: '', //密码
    charset: '', // 数据库编码，默认 utf8 【可选】
    db: '' // 可指定数据库，也可以不指定 【可选】
  }
])
```

## 文档

* [2.x 版文档](docs/2.x.md)
* [3.x 版文档](docs/3.x.md)
