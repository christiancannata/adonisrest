'use strict'
const inflect = require('i')()

class ApiController {

  async index({params, request, response}) {
    await this.prepare(params)
    const entities = await this.model.all()
    return entities
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

}

module.exports = ApiController
