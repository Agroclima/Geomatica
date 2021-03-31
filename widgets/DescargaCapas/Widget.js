///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
var userToken, userPortal = null;
var gLayerPam;
var selectedFeatures = [];
var layerNameDownload;
define([
	'dojo/_base/declare', 
  'jimu/BaseWidget', 
  "dojo/Deferred",
  "dojo/_base/lang",
	'esri/geometry/projection', 
	'esri/geometry/coordinateFormatter', 
	'jimu/dijit/Message',
	'./js/jquery/jquery',
	'esri/layers/GraphicsLayer',
	"dojo/_base/array",
  "esri/tasks/QueryTask", 
  "esri/tasks/query",
  'jimu/portalUtils',
  'jimu/portalUrlUtils',
  "esri/layers/FeatureLayer",
  "esri/symbols/SimpleFillSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/toolbars/draw",
  "dojo/dom",
  "dojo/on",
  "dojo/parser",
  "esri/Color",
  "dijit/layout/TabContainer", 
  "dijit/layout/ContentPane", 
	],function (
		declare, 
    BaseWidget, 
    Deferred,
    lang,
		projection, 
		coordinateFormatter,
		Message,
		jquery,
		GraphicsLayer,
    arrayUtils,
    QueryTask, 
    Query,
    portalUtils,
    portalUrlUtils,
    FeatureLayer, 
    SimpleFillSymbol, 
    SimpleLineSymbol,
    Draw, 
    dom, 
    on, 
    parser, 
    Color,
    TabContainer,
    ContentPane, 
    ) 
    {
      var exportXLSX;
      //To create a widget, you need to derive from BaseWidget.
      return declare([BaseWidget], {
        name: "DescargaCapas",
        startup: function () {
          this.inherited(arguments);
          layerNameDownload = this.config.layerNameDownload;
          exportXLSX = this.exportXLSX;

          //Obtengo el token del usuario logueado de portal
          this.getUserTokenPortal();
          
          // Identifico la capa del pam, la cual se podrá exportar porseleccion en formato excel.
          this.getLayerPam();

          parser.parse();

          // Inicio el toolbar de seleccion
          this.initSelectToolbar();

          // Creo los tabs (descarga de capas completas y descarga por selección)
          this.creaTabs();

          $("#listado-capas").html("");
          $("#lbl-usuario").html('Usuario Arcgis Online: ' + userPortal.username);

          // // Obtengo los services
          this.getFeatureServer(userToken).then(
            lang.hitch(this, function(response) { 
              console.log('response FeatureServer: ', response);
              this.getLayers(response).then(
                lang.hitch(this, function(resp) { 
                  console.log('response Layers: ', resp);
                }),
                function(objErr) {
                  console.log('request failed', objErr)
                }
              );
            }),
            function(objErr) {
              console.log('request failed', objErr)
            }
          );
        },

        creaTabs: function () {
          var tabContainerR = new TabContainer({
            style: "height: 400px; width: 530px;"
          }, "main-container");
      
          var cp1 = new ContentPane({
            title: "Descarga capa completa",
            content: this.tabNode1,
            style: "padding: 20px;"
          });
          
          tabContainerR.addChild(cp1);
      
          var cp2 = new ContentPane({
            title: "Descarga por seleccion",
            content: this.tabNode2,
            style: "padding: 20px;"
          });
          
          tabContainerR.addChild(cp2);
          tabContainerR.startup();
        },

        initSelectToolbar: function (event) {
          console.log('event: ', event);
          selectionToolbar = new Draw(this.map);
          var selectQuery = new Query();

          on(selectionToolbar, "DrawEnd", function (geometry) {
            selectionToolbar.deactivate();
            selectQuery.geometry = geometry;
            gLayerPam.selectFeatures(selectQuery,
              gLayerPam.SELECTION_NEW);
          });
        },

        getUserTokenPortal: function () {
          var portalUrl = portalUrlUtils.getStandardPortalUrl(this.appConfig.portalUrl);
          var portal = portalUtils.getPortal(portalUrl);
          userPortal = portal.user;
          userToken = userPortal.credential.token;
          console.log('portal: ', portal);
        },

        getLayerPam: function () {
          var fieldsSelectionSymbol =
          new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
            new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT,
          new Color([255, 0, 0]), 2), new Color([255, 255, 0, 0.5]));

          for(layerName in this.map._layers)
          {
            if (layerName === layerNameDownload)
            {
              gLayerPam = this.map._layers[layerName];
              gLayerPam.setSelectionSymbol(fieldsSelectionSymbol);
              gLayerPam.on("selection-complete", function (e) {
                selectedFeatures = e.features.map((feature) => feature.attributes);
                $("#txt-selected").text(e.features.length + ' Entidades seleccionadas.');
              });
            } 
          }
          
        },

        _onClickSelectFields: function () {
          selectionToolbar.activate(Draw.EXTENT);
        },
        
        _onClickClearSelectedFields: function () {
          gLayerPam.clearSelection();
          $("#txt-selected").text('0 entidades seleccionadas');
          selectedFeatures = [];
        },

        _onClickDownloadSelected: function () {
          if (selectedFeatures.length > 0)
          {
            exportXLSX(layerNameDownload + '.xlsx', selectedFeatures, 'Hoja1');
          }else{
            this.showMessage('Debe seleccionar al menos un registro', 'error');
          }
        },

        _onClickDownload: function () {
          var existen = false;
          var config = this.config;
          $("#loading-contenido").show();
          $("#btn-descarga").hide();
          $('#listado-capas input:checked').each(function() {
            let url = config.urlBase + $(this).data('folder') + '/FeatureServer/' + $(this).data('code');
            let name = $(this).data('name');
            console.log('acaaaaaaaaaaa layer: ', url);
            existen = true;
            var qt = new QueryTask(url);
            var query = new Query();
            query.outFields = ['*'];
            query.where = "1=1";
            query.returnGeometry = false;
            qt.execute(query, function (response) {
              console.log('response execute: ', response);
              if(response.hasOwnProperty("error"))
              {
                this.showMessage(response.message, 'error');
                this.showMessage('Debe seleccionar al menos una capa', 'error');
                $("#loading-contenido").hide();
                $("#btn-descarga").show();
              }else{
                var data = response.features.map((feature) => feature.attributes);
                console.log('response data: ', data);
                exportXLSX(name + '.xlsx', data, 'Hoja1');
              }
            });
          });

          if(!existen)
          {
            this.showMessage('Debe seleccionar al menos una capa', 'error');
          }
          
          $("#loading-contenido").hide();
          $("#btn-descarga").show();
        },

        exportXLSX: function (fileName, jsonData, sheetName) {
          var ws = XLSX.utils.json_to_sheet(jsonData);
          var wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          XLSX.writeFile(wb,fileName);
        },

        _search: function () {
          // Declare variables
          var input, filter, content, details, summary, i, txtValue;
          input = document.getElementById('search');
          filter = input.value.toLowerCase();
          content = document.getElementById("listado-capas");
          details = content.getElementsByTagName('details');

          // Loop through all list items, and hide those who don't match the search query
          for (i = 0; i < details.length; i++) {
            summary = details[i].getElementsByTagName("summary")[0];
            txtValue = summary.textContent || summary.innerText;
            if (txtValue.toLowerCase().indexOf(filter) > -1) {
              details[i].style.display = "";
            } else {
              details[i].style.display = "none";
            }
          }
        },

        _onClickClear: function () {
          $("#search").val("");
          content = document.getElementById("listado-capas");
          ar = content.getElementsByTagName('details');
          for (i = 0; i < ar.length; ++i){
            ar[i].style.display = "";
          }
        },

        getFeatureServer: function (token) {
          var deferred = new Deferred();
          var services = [];
          var res = {};
          let url = this.config.urlBase + this.config.layersFolder + '/FeatureServer?token=' + token + '&f=json'
          console.log('urllll: ', url);
          this.getRequest(url).then(
            lang.hitch(this, function(response) { 
              console.log('response getFeatureServer: ', response);
              if (response.hasOwnProperty("error"))
              {
                // this._onClickSalir()
                console.log('response error: ', response);
                this.showMessage(response.error.message, 'error');
                deferred.reject();
              }else{
                if (response.hasOwnProperty("layers")){
                  console.log('response bien: ', response);
                  arrayUtils.forEach(response.layers, function(f) {
                    console.log('fffffffffffff: ', f);
                    services.push(f); 
                  }, this);
                  res.services = services
                  res.token = token
                  deferred.resolve(res);
                }else{
                  //TODO: si falla el token del localstorage, aca deberia remover
                  // localStorage.removeItem('usertoken');
                  // Mostrar el login y ocultar listado-capas, opciones y btn-descarga
                  // this._onClickSalir()
                  console.log('response error: ', response);
                  this.showMessage('El folder no tiene layers...', 'error');
                  deferred.reject();
                }
              }
            }),
            function(objErr) {
              console.log('request failed', objErr)
              deferred.reject();
            }
          );
          return deferred.promise;
        },

        getLayers: function (resp) {
          $("#loading-contenido").show();
          var deferred = new Deferred();
          var services = resp.services;
          var config = this.config;
          console.log('services: ', services);
          var html = '';
          arrayUtils.forEach(services, function(f) {
            html += '<details><summary>' + f.name + '</summary>'
            html += '<label class="label-layer">'
            html += '<input type="checkbox" data-folder="' + config.layersFolder + '" data-parent="' + f.name + '" data-name="' + f.name + '" data-code="' + f.id + '" style="margin-right: 10px;" aria-label="' + f.name + '">'
            html += f.name + '</label><br />'
            html += '</details>'
          }, this);
          $("#loading-contenido").hide();
          $('#listado-capas').append(html);
          deferred.resolve('ok');
          return deferred.promise;
        },
        
        getRequest: function (url) {
          try{
            var deferred = new Deferred();
            fetch(url)
              .then(data => data.text())
              .then((text) => {
                var data = JSON.parse(text);
                deferred.resolve(data);
              }).catch(function (error) {
                console.log('request failed', error)
                deferred.reject();
              }
            );
          } catch(err) {
            console.log('request failed', err)
            deferred.reject();
          }
          return deferred.promise;
        },

        postRequest: function (url, formData) {
          try{
            var deferred = new Deferred();
            
            let fetchData = {
                method: 'POST',
                body: formData,
                headers: new Headers()
            }
    
            fetch(url, fetchData)
              .then(data => data.text())
              .then((text) => {
                var data = JSON.parse(text);
                console.log('responseee: ', data)
                deferred.resolve(data);
    
              }).catch(function (error) {
                console.log('request failed', error)
                deferred.reject();
              }
            );
          } catch(err) {
            console.log('request failed', err)
            deferred.reject();
          }
          return deferred.promise;
        },

        showMessage: function (msg, type) {
          var class_icon = "message-info-icon";
          switch (type) {
            case "error":
              class_icon = "message-error-icon";
              break;
              case "warning":
                class_icon = "message-warning-icon";
                break;
            }
            var content = '<i class="' + class_icon + '">&nbsp;</i>' + msg;
            new Message({
              titleLabel: type.toUpperCase(),
              message: content
            });
        },

        postCreate: function () {
          this.inherited(arguments);
          console.log('postCreate');
        },

        onOpen: function () {
          console.log('onOpen');
        },

        onClose: function () {
          console.log('onClose');
        },

        onMinimize: function () {
          console.log('onMinimize');
        },

        onMaximize: function () {
          console.log('onMaximize');
        },

        onSignIn: function (credential) {
          console.log('onSignIn');
        },
        
        onSignOut: function () {
          console.log('onSignOut');
        }
      });
    }
);