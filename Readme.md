![module info](https://nodei.co/npm/mysqli.png?downloads=true&downloadRank=true&stars=true)
# mysqli
> 本模块基于node-mysql模块二次封装，对基础的增删改查，主从库等按js的特点进行了简化，并对SQL注入进行安全过滤，让没有SQL基础的人，也能顺利使用;
> 当然，一些复杂的查询，以及事务等，这些不在我的服务之内，而且会用到这些功能的童鞋，本身也有一定的SQL基础了; 所以，这类童鞋，请自行使用各自习惯的SQL模块，或手写实现。



## 使用npm安装

```bash
npm install mysqli
```


## 实例化
> 实例化可以传2种格式的配置，1是json对象，2是数组。
> 只有一个数据库时，默认是主库; 多于1个数据库服务时，自动以第1个为主库，其他的从库，故实例化时，`注意顺序`。


```javascript
    
let Mysqli = require('mysqli')

//传入json
let conn = new Mysqli({
        host: '', // IP/域名
        post: 3306, //端口， 默认 3306
        user: '', //用户名
        passwd: '', //密码
        charset: '', // 数据库编码，默认 utf8 【可选】
        db: '', // 可指定数据库，也可以不指定 【可选】
    })

// 传入数组
let conn = new Mysqli([
        {
            host: 'host1', // IP/域名
            post: 3306, //端口， 默认 3306
            user: '', //用户名
            passwd: '', //密码
            charset: '', // 数据库编码，默认 utf8 【可选】
            db: '', // 可指定数据库，也可以不指定 【可选】
        },
        {
            host: 'host2', // IP/域名
            post: 3306, //端口， 默认 3306
            user: '', //用户名
            passwd: '', //密码
            charset: '', // 数据库编码，默认 utf8 【可选】
            db: '', // 可指定数据库，也可以不指定 【可选】
        },
    ])

```


## API方法


### 1. escape(val)
> 这是`node-mysql`的内部方法，用于进行SQL安全过滤，这里只是做了搬运工，把它暴露出来给外部调用而已。


### 2. listDB()
> 顾名思义，该方法即用于列举当前账号权限范围内的所有的数据库名称，返回值是一个数组;
> 
> **注：**`该方法配置await指令可得到纯粹的数据，否则返回的是一个Promise对象`

```javascript

async function(){
    let db = await conn.listDB()
    console.log(db)
}

// 不使用await指令时，返回的是Promise对象
conn.listDB().then(db => {
    console.log(db)
})


```


### 3. useDB(db[, slave])
- db `<String>`
- slave `<Boolean>` 可选

> 该方法用于切换数据库，仅限于同一台机器上的数据库;  在配置中没有指定数据库的情况下，必须先调用该方法才可以进行后续的增删改查等操作。
> 
> `db`即为要切换的数据库名; `slave`为是否从库查询，默认主库。

```javascript

async function(){

    let docs = await conn.useDB('xx').query(`select * from users limit 10`);
    console.log(docs);

}

// 不使用await指令时，返回的是Promise对象
conn.useDB('xx')
    .query(`select * from users limit 10`)
    .then(docs => {
        console.log(docs)
    })


```



### 4. query(sql[, slave])
- sql `<String>`
- slave `<Boolean>` 可选

> 该方法用于当内置的方法满足不了需求时，可以自行编写`sql语句`执行; 但要注意防止`sql注入`，因为该方法是最基础的方法，模块不对传入的`sql语句`进行任何的安全过滤。
> 
> `sql`即为要执行的sql语句; `slave`为是否从库查询，默认主库。

```javascript

async function(){

    let docs = await conn.query(`select * from users limit 10`);
    console.log(docs);

}

// 不使用await指令时，返回的是Promise对象
conn.query(`select * from users limit 10`)
    .then(docs => {
        console.log(docs)
    })

```



### 5. find(conf)
- conf `<Object>`

> 该方法用于查询多条数据。无论结果是多少条，返回的都是`数组格式`; 详细请看下面代码示例：

```javascript

conn.find({
    table: '', // 要查询的表
    select: ['a', 'b'], //要返回的字段，不传默认返回所有 【可选】
    where: [{ //数组格式,可以组成多个条件,默认查询全表 【可选】
        join: 'OR', //条件关系 AND, OR
        op: '>', //关系符,如 =, >, <, <=, >=
        key: 'aa',
        val: 23
    }],
    sort: { //排序, key是要排序的字段,value是排序方式, 1顺序,-1逆序 【可选】
        a: 1,
        b: -1
    },
    limit: { // 查询范围,可用于分页 【可选】
        start: 0,
        size: 10
    },
    slave: false // 是否从库 【可选】
})

// 其中，table这一项，还可以联表，但是仅限于 'left join'，要使用其他的方式联表，请自行编写sql语句
// where条件也可以直接使用sql语句，要注意防止注入。

conn.find({
    table: {
        master: 'xx',
        unite: [
            {
                table: 'aa',
                on: 'xx.id = aa.xid'
            },
            //... 可以联多个表， 但都是 left join
        ]
    },
    where: `xx.id = 123`
})

```



### 6. findOne(conf)
- conf `<Object>`

> 该方法与上面的`find`方法的使用一致，区别只是该方法只返回一条数据，且为`json格式`。


### 7. count(conf)
- conf `<Object>`

> 该方法与上面的`find`方法的使用一致，不过返回的是条目总数(`<Number>`)


### 8. insert(conf)
- conf `<Object>`

> 该方法与上面的`find`方法的使用类似，手于插入一条数据，具体请看下面代码;
> 
> **注：**`该方法一次只能插入一条数据`

```javascript

// 如果主键是自增ID，则结果返回的是 刚插入的数据的自增ID
conn.insert({
    table: 'xx',
    data: {}, //要插入的数据
})

```


### 9. update(conf)
- conf `<Object>`

> 该方法与上面的`find`方法的使用类似，用于更新数据，具体请看下面代码;
> `该方法返回的是被修改的条目数量`

```javascript

// 如果修改成功，则返回被修改的数量
conn.update({
    table: 'xx',
    data: {}, //要修改的数据
    where: `id = 123`
})

```


### 10. remove(conf)
- conf `<Object>`

> 该方法与上面的`find`方法的使用类似，用于删除指定条件的数据; 具体请看下面代码;
> `该方法返回的是被删除的条目数量`

```javascript

// 如果修改成功，返回的是被删除的条目数量
conn.update({
    table: 'xx',
    data: {}, //要修改的数据
    where: `id = 123`
})

```



