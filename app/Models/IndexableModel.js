'use strict'

const Model = use('Model')
const Env = use('Env')
const Elastica = require('elasticsearch').Client({
  host: Env.get('elastica_host', 'localhost') + ':' + Env.get('elastica_port', 9200)
});
const inflect = require('i')()

class IndexableModel extends Model {
  static boot() {
    super.boot()


    this.addHook('afterCreate', async (model) => {


      Elastica.create({
        index: inflect.underscore(model.constructor.name),
        type: inflect.underscore(model.constructor.name),
        id: model.id,
        body: model.toJSON()
      }, function (error, response) {

      });

    })

    this.addHook('afterUpdate', async (model) => {

      Elastica.update({
        index: inflect.underscore(model.constructor.name),
        type: inflect.underscore(model.constructor.name),
        id: model.id,
        body: {
          doc: model.toJSON()
        },
      }, function (error, response) {

      });

    })

    this.addHook('afterDelete', async (model) => {

      Elastica.delete({
        index: inflect.underscore(model.constructor.name),
        type: inflect.underscore(model.constructor.name),
        id: model.id
      }, function (error, response) {

      });

    })


  }


  static search() {
    var results = [];

// first we do a search, and specify a scroll timeout
    Elastica.search({
      index: inflect.underscore(this.name),
      q: 'id:3'
    }, function getMoreUntilDone(error, response) {
      console.log(response)
    });
  }

}

module.exports = IndexableModel
