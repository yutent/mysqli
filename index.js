/**
 * mysql操作类
 * @authors yutent (yutent@doui.cc)
 * @date    2015-11-24 11:31:55
 *
 */
"use strict";
require('es.shim')
let mysql = require('mysql')
/**
 * [parseWhere 格式化where条件]
 * @param  [array] arr [条件数组]
 */

function parseWhere(arr){

    if(typeof arr === 'string' && !!arr){
        return ' WHERE ' + arr
    }else if(Array.isArray(arr) && arr.length > 0){

        let where = ''
        for(let it of arr){
            it.join = it.join || 'AND'
            it.op = it.op || '='
            
            let fixVal = it.val
            if(!/(^\(SELECT\s+.*\)$)|^`/.test(it.val) && !['IN', 'BETWEEN'].includes(it.op)){
                
                fixVal = mysql.escape(it.val)
            }
            
            where += `${it.join.toUpperCase()} ${it.key} ${it.op} ${fixVal} `
        }

        where = ' WHERE ' + where.trim().replace(/^(AND|OR)/, ' ') + ' '
        return where

    }else{
        return ' '
    }
    
}

class Mysqli{

    /**
     * [constructor 构造数据库连接]
     */
    constructor(conf){
        if(!Array.isArray(conf))
            conf = [conf]
        
        //是否有从库
        this.slave = conf.length > 1
        this.conn = null
        
        this.pool = mysql.createPoolCluster()
        let idx = 0
        while(idx < conf.length){
            let cf = conf[idx]
            cf.charset = cf.charset || 'utf8'
            let name = idx === 0 ? 'MASTER' : ('SLAVE' + idx)

            idx++
            this.pool.add(name, {
                host: cf.host,
                port: cf.port,
                user: cf.user,
                password: cf.passwd,
                charset: cf.charset,
                collate: cf.charset + ((cf.charset === 'utf8mb4') ? '_unicode_ci' : '_general_ci'),
                database: cf.db
            })
        }
    }

    //对外的escape方法
    escape(val){
        return mysql.escape(val)
    }


    //返回数据库列表
    listDB(){
        return new Promise((yes, no) => {
            this.pool
                .getConnection((err, conn) => {
                    if(err)
                        return no(`MySQL connect ${err}`)

                    conn.query('SHOW databases', (err, docs) => {

                        conn.release()

                        if(err)
                            return no('SHOW databases ' + err)

                        let res = []
                        for(let it of docs){
                            res.push(it.Database)
                        }
                        yes(res)
                    })
                })
        })
    }


    //选择database
    useDB(db, slave){
        slave = (slave && this.slave) ? 'SLAVE*' : 'MASTER'

        this.conn = (async () => {
            return await new Promise((yes, no) => {

                this.pool
                    .getConnection(slave, (err, conn) => {
                        if(err)
                            return no(`MySQL connect ${err}`)

                        conn.query('USE ' + db, (err) => {

                            if(err)
                                return no('Select DB ' + err)

                            yes(conn)
                        })
                    })

            })
        })()
        return this
    }


    /**
     * [query sql语句执行]
     * @param  {[type]}   sql       [sql语句]
     * @param  {boolean} slave      [是否从库]
     */
    query(sql, slave){
        slave = (slave && this.slave) ? 'SLAVE*' : 'MASTER'

        if(typeof sql !== 'string')
            return Promise.reject(`query error, argument sql must be string. ${typeof sql} given`)

        return new Promise((yes, no) => {

            if(this.conn){
                this.conn.then(conn => {

                    conn.query(sql, (err, res) => {
                        conn.release()
                        this.conn = null

                        if(err)
                            return no(`Query ${err}; Last exec SQL: ${sql}`)

                        yes(res)
                    })

                }).catch(no)
            }else{
                this.pool.getConnection(slave, (err, conn) => {
                    if(err)
                        return no(`MySQL connect ${err}`)

                    conn.query(sql, (err, res) => {

                        conn.release()

                        if(err)
                            return no(`Query ${err}; Last exec SQL: ${sql}`)

                        yes(res)

                    })
                })
            }

        })
    }



    /**
     * [find 基础的数据查询, 支持简单的联表查询]
     * @param  {[type]}   conf     [要查询的信息]
     *
     * e.g.
     * .find({
     *     table: '',
     *     select: ['a', 'b'],
     *     where: [{ //数组格式,可以组成多个条件,默认查询全表 [可选]
     *         join: 'OR', //条件关系 AND, OR
     *         op: '>', //关系符,如 =, >, <, <=, >=
     *         key: 'aa',
     *         val: 23
     *     }],
     *     sort: { //排序, key是要排序的字段,value是排序方式, 1顺序,-1逆序 [可选]
     *         a: 1,
     *         b: -1
     *     },
     *     limit: { // 查询范围,可用于分页 [可选]
     *         start: 0,
     *         size: 10
     *     }
     * })
     */
    find(conf){
        conf.slave = (conf.slave && this.slave) ? 'SLAVE*' : 'MASTER'
        
        if(!conf.table)
            return Promise.reject('Find Error: empty table')

        let fields = '' //-------要返回的字段 ----------------
        if(!conf.hasOwnProperty('select') || Object.empty(conf.select))
            fields = '*'
        else
            fields = conf.select.join(',')

        let sql = 'SELECT ' + fields

        let table = '' //---------要查询的表 -----------------
        if(typeof conf.table === 'string'){ //单表
            table = ' FROM ' + conf.table
        }else{ //联表
            table = ' FROM ' + conf.table.master
            for(let join of conf.table.unite){
                table += ` LEFT JOIN  ${join.table} ON ${join.on} `
            }
        }
        sql += table

        //查询条件 ---------------------------------------
        sql += parseWhere(conf.where)

        let sort = '' //排序 ----------------------------------
        if(conf.sort && typeof conf.sort === 'object'){
            sort = ' ORDER BY '
            for(let i in conf.sort){
                let c = ''
                if(conf.sort[i] === -1)
                    c = 'DESC'

                sort += `${i} ${c},`
            }
            sort = sort.slice(0, -1)
        }
        sql += sort

        let limit = '' //--------查询范围 ----------
        if(conf.hasOwnProperty('limit')){
            let start = conf.limit.start || 0
            let size = (conf.limit.size && conf.limit.size > 0) ? conf.limit.size : 1
            limit = ` LIMIT ${start},${size} `
        }
        sql += limit

        return new Promise((yes, no) => {

            if(this.conn){
                this.conn.then(conn => {

                    conn.query(sql, (err, res) => {
                        conn.release()
                        this.conn = null

                        if(err)
                            return no(`Find ${err}; Last exec SQL: ${sql}`)

                        yes(res)
                    })

                }).catch(no)
            }else{
                this.pool.getConnection(conf.slave, (err, conn) => {
                    if(err)
                        return no(`MySQL connect ${err}`)

                    conn.query(sql, (err, res) => {

                        conn.release()

                        if(err)
                            return no(`Find ${err}; Last exec SQL: ${sql}`)

                        yes(res)

                    })
                })
            }

        })
    }

    /**
     * [findOne 查找一条记录, 参数同 find]
     */
    findOne(conf){
        let res = (async () => this.find({
                table: conf.table,
                select: conf.select || [],
                where: conf.where || '',
                sort: conf.sort,
                slave: conf.slave,
                limit: {start: 0, size: 1}
            }))()
        return new Promise((yes, no) => {
            res.then(list => {
                yes(list[0] || null)
            }, no)
        })
    }

    /**
     * [count 计算结果总数, 参数同findOne]
     */
    count(conf){
        let res = (async () => this.find({
                table: conf.table,
                select: ['count(*) AS total'],
                slave: conf.slave,
                where: conf.where || ''
            }))()
        return new Promise((yes, no) => {
            res.then(list => {
                yes(list[0] && list[0].total || 0)
            }, no)
        })
    }

    /**
     * [insert 插入数据,单条]
     * @param  {[object]}   conf     [要插入的信息,{table: '', data: {}} ]
     * 
     * eg.
     * .insert({
     *     table: 'test',
     *     data: {aa: 123, bb: 456}
     * }, function(id){...})
     */
    insert(conf){
        conf.slave = (conf.slave && this.slave) ? 'SLAVE*' : 'MASTER'

        if(!conf.table)
            return Promise.reject('Insert Error: empty table')

        let sql = 'INSERT INTO ' + conf.table + ' ('
        let keys = []
        let vals = []

        for(let i in conf.data){
            keys.push(i)
            vals.push(mysql.escape(conf.data[i]))
        }
        sql += `${keys.join(',')}) VALUES (${vals.join(',')})`

        return new Promise((yes, no) => {

            if(this.conn){
                this.conn.then(conn => {

                    conn.query(sql, (err, res) => {
                        conn.release()
                        this.conn = null

                        if(err)
                            return no(`Insert ${err}; Last exec SQL: ${sql}`)

                        yes(res.insertId)
                    })

                }).catch(no)
            }else{
                this.pool.getConnection(conf.slave, (err, conn) => {
                    if(err)
                        return no(`MySQL connect ${err}`)

                    conn.query(sql, (err, res) => {

                        conn.release()

                        if(err)
                            return no(`Insert ${err}; Last exec SQL: ${sql}`)

                        yes(res.insertId)

                    })
                })
            }

        })
    }

    /**
     * [insert 基础的数据修改]
     * @param  {[object]}   conf     [要修改的信息, {table: '', where: [], data: {}}]
     * 
     * eg.
     * .update({
     *     table: 'test',
     *     data: {aa: 123, bb: 456},
     *     where: [{ //数组格式,可以组成多个条件
     *         join: 'OR', //条件关系 AND, OR
     *         op: '>', //关系符,如 =, >, <, <=, >=
     *         key: 'aa',
     *         val: 23
     *     }]
     * }, function(nums){...})
     */
    update(conf){
        conf.slave = (conf.slave && this.slave) ? 'SLAVE*' : 'MASTER'

        if(!conf.table)
            return Promise.reject('Update Error: empty table')

        let sql = 'UPDATE ' + conf.table + ' SET '

        let fields = [] //要更新的字段
        for(let i in conf.data){
            fields.push(i + ' = ' + mysql.escape(conf.data[i]))
        }
        sql += fields.join(',')
        sql += parseWhere(conf.where)

        return new Promise((yes, no) => {

            if(this.conn){
                this.conn.then(conn => {

                    conn.query(sql, (err, res) => {
                        conn.release()
                        this.conn = null

                        if(err)
                            return no(`Update ${err}; Last exec SQL: ${sql}`)

                        yes(res.affectedRows)
                    })

                }).catch(no)
            }else{
                this.pool.getConnection(conf.slave, (err, conn) => {
                    if(err)
                        return no(`MySQL connect ${err}`)

                    conn.query(sql, (err, res) => {

                        conn.release()

                        if(err)
                            return no(`Update ${err}; Last exec SQL: ${sql}`)

                        yes(res.affectedRows)

                    })
                })
            }

        })
        
    }

    /**
     * [remove 基础的数据删除]
     * @param  {[type]}   conf     [要删除的信息, {table: '', where: []}]
     * 
     * eg.
     * .update({
     *     table: 'test',
     *     where: [{ //数组格式,可以组成多个条件
     *         join: 'OR', //条件关系 AND, OR
     *         op: '>', //关系符,如 =, >, <, <=, >=
     *         key: 'aa',
     *         val: 23
     *     }]
     * }, function(nums){...})
     */
    remove(conf){
        conf.slave = (conf.slave && this.slave) ? 'SLAVE*' : 'MASTER'

        if(!conf.table)
            return Promise.reject('Remove Error: empty table')

        let sql = 'DELETE FROM ' + conf.table
        
        if(conf.where)
            sql += parseWhere(conf.where)

        return new Promise((yes, no) => {

            if(this.conn){
                this.conn.then(conn => {

                    conn.query(sql, (err, res) => {
                        conn.release()
                        this.conn = null

                        if(err)
                            return no(`Remove ${err}; Last exec SQL: ${sql}`)

                        yes(res.affectedRows)
                    })

                }).catch(no)
            }else{
                this.pool.getConnection(conf.slave, (err, conn) => {
                    if(err)
                        return no(`MySQL connect ${err}`)

                    conn.query(sql, (err, res) => {

                        conn.release()

                        if(err)
                            return no(`Remove ${err}; Last exec SQL: ${sql}`)

                        yes(res.affectedRows)

                    })
                })
            }

        })
    }



}



module.exports = Mysqli