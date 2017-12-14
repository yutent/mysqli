![module info](https://nodei.co/npm/mysqli.png?downloads=true&downloadRank=true&stars=true)

# mysqli

> 本模块基于 node-mysql 模块二次封装，对基础的增删改查，主从库等按 js 的特点进行
> 了简化，并对 SQL 注入进行安全过滤，让没有 SQL 基础的人，也能顺利使用 ; 当然，
> 一些复杂的查询，以及事务等，这些不在我的服务之内，而且会用到这些功能的童鞋，本
> 身也有一定的 SQL 基础了 ; 所以，这类童鞋，请自行使用各自习惯的 SQL 模块，或手
> 写实现。

## 使用 npm 安装

```bash
npm install mysqli
```

## 实例化

> 实例化可以传 2 种格式的配置，1 是 json 对象，2 是数组。只有一个数据库时，默认
> 是主库 ; 多于 1 个数据库服务时，自动以第 1 个为主库，其他的从库，故实例化时
> ，`注意顺序`。

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

## API 方法

### 1. escape(val)

> 这是`node-mysql`的内部方法，用于进行 SQL 安全过滤，这里只是做了搬运工，把它暴
> 露出来给外部调用而已。 **这个是静态方法**

```javascript
const Mysqli = require('mysqli')

Mysqli.escape('这是文本')
```

### 2. emit(isSlave, dbName)

* isSlave `<Boolean>` 可选
* dbName `<String>` 可选。 如果在实例化连接时 , 已经传入 db, 则这里可不传值。

> 触发一个数据库实例 , 可接受 2 个参数 , 第 1 个为 " 是否从库 ", 第 2 个为 " 数
> 据库名称 "

```javascript
const Mysqli = require('mysqli')
let conn = new Mysqli({
  /*...*/
})
let db = conn.emit(true, 'test')
```

### 3. listDb()

> 顾名思义，该方法即用于列举当前账号权限范围内的所有的数据库名称，返回值是一个数
> 组 ;
>
> **注：**`方法返回的是一个 Promise 对象`

```javascript
db.listDb().then(list => {
  console.log(list)
})
```

### 4. listTable()

> 该方法用于列举当前数据库数据表的集合

```javascript
db.listTable().then(list => {
  console.log(list)
})
```

### 5. query(sql)

* sql `<String>`

> 该方法用于当内置的方法满足不了需求时，可以自行编写`sql 语句`执行 ; 但要注意防
> 止`sql 注入`，因为该方法是最基础的方法，模块不对传入的`sql 语句`进行任何的安全
> 过滤。

```javascript
// 不使用await指令时，返回的是Promise对象
db.query(`select * from users limit 10`).then(row => {
  console.log(row)
})
```

### 6. filter(condition, select)

* condition `<Object>`, 查询条件
* select `<Array>`, 要返回字段 , 默认全部返回

> 该方法用于查询多条数据。无论结果是多少条，返回的都是`数组格式`; 详细请看下面代
> 码示例：

```javascript
db
  .filter(
    {
      table: '', // 要查询的表
      where: [
        {
          //数组格式,可以组成多个条件,默认查询全表 【可选】
          join: 'OR', //条件关系 AND, OR
          op: '>', //关系符,如 =, >, <, <=, >=
          key: 'aa',
          val: 23
        }
      ],
      sort: {
        //排序, key是要排序的字段,value是排序方式, 1顺序,-1逆序 【可选】
        a: 1,
        b: -1
      },
      limit: [0, 1] // 查询范围,可用于分页 【可选】
    },
    ['a', 'b']
  )
  .then(row => {
    console.log(row)
  })
```

### 7. filterOne(condition)

* condition `<Object>`

> 该方法与上面的`filter`方法的使用一致，区别只是该方法只返回一条数据，且为`json
> 格式`。

### 8. count(condition)

* condition `<Object>`

> 该方法与上面的`filter`方法的使用一致，不过返回的是条目总数 (`<Number>`)

### 9. insert(condition, doc)

* condition `<Object>`, 插入的条件
* doc `<Object>`, 插入的数据

> 该方法与上面的`filter`方法的使用类似，手于插入一条数据，具体请看下面代码 ;
>
> **注：**`该方法一次只能插入一条数据`

```javascript
// 如果主键是自增ID，则结果返回的是 刚插入的数据的自增ID
db
  .insert(
    {
      table: 'xx'
    },
    { xx: 1234 } //要插入的数据
  )
  .then(id => {
    console.log(id)
  })
```

### 10. update(condition, doc)

* condition `<Object>`, 条件
* doc `<Object>`, 数据

> 该方法与上面的`filter`方法的使用类似，用于更新数据，具体请看下面代码 ; `该方法返
> 回的是被修改的条目数量`

```javascript
// 如果修改成功，则返回被修改的数量
db
  .update(
    {
      table: 'xx'
    },
    { xx: 1234 } //要插入的数据
  )
  .then(num => {
    console.log(num)
  })
```

### 11. remove(condition)

* condition `<Object>`

> 该方法与上面的`update`方法的使用类似，用于删除指定条件的数据 ; 具体请看下面代码
> ; `该方法返回的是被删除的条目数量`

```javascript
// 如果修改成功，返回的是被删除的条目数量
db
  .remove(
    {
      table: 'xx'
    }
  )
  .then(num => {
    console.log(num)
  })
```
