'use strict'
const inflect = require('i')()
const Database = use('Database')
const Validator = use('Adonis/Addons/Validator')

class ApiController {


  async search({params, request, response}){
    await this.prepare(params)
    await this.model.search()
  }

  async show({params, request, response}){
    await this.prepare(params)
    const resource = await this.model.findOrFail(this.id)
    return resource
  }


  async index({params, request, response}) {
    await this.prepare(params)

    const parentResource = request.input('parent')
    const parent = this.resource(parentResource)
    const parentId = request.input('parentId')
    let parentInstance
    let query = this.model.query()
    if (parent && parentId) {
      parentInstance = parent.findOrFail(parentId)
      const field = inflect.foreign_key(inflect.singularize(parentResource))
      // query = parentInstance[request.param('resource')]
      query.where(field, parentId)
    }


    let filter = JSON.parse(request.input('query', request.input('filter', request.input('where'))))
    let offset = request.input('offset', request.input('skip', 0))
    let limit = request.input('perPage', request.input('limit', this.params.defaultPerPage))

    let page = Math.max(1, request.input('page', Math.floor(offset / limit) + 1))

    let fields = request.input('fields', this.config.index.fields)
    let hidden = request.input('hidden', this.config.index.hidden)
    let extra = request.input('extra', this.config.index.extra)
    let expand = request.input('related', request.input('expand', this.config.index.expand))
    let groupBy = request.input('groupBy')
    let orderBy = request.input('orderBy', request.input('sort'))
    let pagination = request.input('pagination', this.config.index.pagination)

    extra = this.split(extra)
    hidden = this.split(hidden)
    fields = this.split(fields)

    let columns = await this.columns(this.model.table)
    if (fields.length < 1) {
      let select = []

      for (let name in columns) {
        if (!hidden.includes(name) && (extra.includes(name) || columns[name].dataType != 'text')) {
          select.push(name)
        }
      }
      fields = select

      if (extra) {
        fields = fields.concat(extra)
      }
    }


    fields && query.select(fields)
    //expand=user,post(id,title)
    if (expand) {
      expand = expand.match(/[\w.]+(\(.+?\))?/ig)
      for (let name of expand) {
        if (name.indexOf('(') > -1) {
          let [none, rel, value] = name.match(/([\w.]+)\((.+?)\)/)
          // config = qs.parse(config) //{fields: 'id,title'}
          query.with(rel)
          query.scope(rel, query => {
            query.select(this.split(value))
          })
          // query.scope(rel, query => {
          //   for (let key in config) {
          //     let value = config[key]
          //     switch (key) {
          //       case 'fields':
          //         query.select(this.split(value))
          //         break;
          //       default:
          //         query[key](value)
          //     }
          //   }
          // })
        } else {
          query.with(name)
        }
      }
      // query.with(expand)
    }
    // groupBy && query.groupBy(groupBy)
    if (orderBy) {
      let dir = 'asc'
      if (orderBy.substr(0, 1) === '-') {
        orderBy = orderBy.substr(1)
        dir = 'desc'
      }
      query.orderBy(orderBy, dir)
    }

    let conditions = []
    const requestData = request.all()

    const keys = 'page query filter per_page perPage limit offset skip where expand fields groupBy orderBy pagination sort extra hidden'.split(' ')
    // deal with fields filters
    for (let name in requestData) {
      if (!keys.includes(name)) {
        query.where(name, requestData[name])
      }
    }
    for (let field in filter) {
      let condition = filter[field]
      if (condition === '') {
        continue
      }
      if (typeof condition === 'string') {
        //query={"title": "a"}
        query.where(field, 'like', `%${condition}%`)
      } else if (Array.isArray(condition)) {
        /**
         * query={"created_at": [">", "2017-07-07"]}
         * query={"created_at": ["between", ["2017-07-01", "2017-07-31"]]}
         * query={"user_id": ["in", [1,2,3] ]}
         * query={"user_id": ["raw", 'user_id = 10' ]}
         */
        let [operator, value] = condition
        let Operator = operator[0].toUpperCase() + operator.slice(1)
        if ([
            'Not',
            'In', 'NotIn',
            'Null', 'NotNull',
            'Exists', 'NotExists',
            'Between', 'NotBetween',
            'Raw'
          ].includes(Operator)) {
          query['where' + Operator](field, value)
        } else {
          query.where(field, operator, value)
        }
      } else {
        query.where(field, condition)
      }
    }

    let results

    if (['1', 'true'].includes(String(pagination))) {
      results = await query.paginate(page, limit)
    } else {
     results = await query.offset(offset).limit(limit).fetch()
    }

    return results.toJSON()
  }

  async store({params, request, response}) {
    await this.prepare(params)
    let instance = new this.model()
    return await this.save(instance, request, response)
  }

  // update - PATCH /api/:resource/:id
  async update({params, request, response}) {
    await this.prepare(params)
    const instance = await this.model.findOrFail(this.id)
    await this.save(instance, request, response)
  }

  // delete - DELETE /api/:resource/:id
  async destroy({params, request, response}) {
    await this.prepare(params)
    const instance = await this.model.findOrFail(this.id)
    const result = await instance.delete()
    response.json(result)
  }

  // return model instance from :resource
  async resource(resource) {
    if (this.model) {
      return this.model
    }
    if (!resource) {
      return
    }
    return use('App/Models/' + inflect.classify(resource))
  }

  async prepare(params) {
    this.resourceName = params.resource
    this.model = await this.resource(this.resourceName)
    this.id = params.id
  }

  async save(instance, request, response) {
    const data = request.all()
    let result
    let model = instance
    if (this.id) {
      model.merge(data)
    } else {
      model.fill(data)
    }
    if (model.rules) {
      let rules = typeof model.rules === 'function' ? model.rules() : model.rules
      let messages = typeof model.messages === 'function' ? model.messages() : model.messages
      const validation = await Validator.validateAll(data, rules, messages)
      if (validation.fails()) {
        return response.status(422).json(validation.messages())
      }
    }
    try {
      result = await model.save()
    } catch (e) {
      return response.status(400).send({
        code: e.code,
        message: e.message
      })
    }
    response.json(model.toJSON())
  }

  async columns(table) {
    return await Database.table(table).columnInfo()
  }

  split(val) {
    return val ? val.split(/\s*,\s*/) : []
  }

  get config() {
    return {
      index: {
        pagination: true,
        // hidden: 'updated_at',
        // extra: 'body',
        // expand: 'user',
      },
      detail: {
        // expand: 'user'
      }
    }
  }

  get params() {
    return {
      defaultPerPage: 10
    }
  }
}

module.exports = ApiController
