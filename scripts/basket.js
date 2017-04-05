function Component(componentElPlaceholder, initialModel, render) {
  var buildEvent = function(eventCallback, ...args) {
    return function(ev) { 
      var newModel = eventCallback(ev, state.model, ...args);
      state = _getNewState(state, newModel, buildEvent);
    };
  };
  
  var state;
  var tree = render(initialModel, buildEvent);
  var rootNode = virtualDom.create(tree);
  state = {tree: tree, render: render, rootNode: rootNode, model: initialModel};

  componentElPlaceholder.innerHTML = "";
  componentElPlaceholder.appendChild(rootNode);
  return state;
}

function _getNewState(state, newModel, event) {
  var newTree = state.render(newModel, event);
  var newRootNode = _updateDOM(state.rootNode, state.tree, newTree);
  return {model: newModel, render: state.render, tree: newTree, rootNode: newRootNode};
}

function _updateDOM(rootNode, originalTree, newTree) {
  var patches = virtualDom.diff(originalTree, newTree);
  return virtualDom.patch(rootNode, patches);
}

var html = virtualDom.h;

//////

_.mixin({
  sortBasketItems: function(items, groups, productsById) {
    return _
      .chain(items)
      .sortBy(function(item) { return productsById[item.id].name; })
      .sortBy(function(item) { return groups.indexOf(productsById[item.id].group); })
      .value();
  }
});

var getPreviousBasket = function(groups, productsById) {
  return _
    .chain($("#comanda option").filter(":selected"))
    .select(option => $(option).val() != "")
    .groupBy(option => $(option).val())
    .map((optionsForProduct, productId) => {
      var ys = _.map(optionsForProduct, (option_el, opt) => {
        var select_id = $(option_el).closest("select").attr("id");
        var quantity_input_id = select_id.replace(/-producte$/, '-quantitat');
        var quantity = $("#" + quantity_input_id).val();
        return parseFloat(quantity);
      });
      var sum = _.reduce(ys, function(memo, num){ return memo + num; }, 0.0);
      return {id: productId, quantity: sum};
    })
    .sortBasketItems(groups, productsById)
    .value();
};
      
var getAllProductsByGroup = function() {
    var productsByGroup = {};
    $('#id_form-0-producte').find("optgroup").slice(1).each(function(idx, optgroup_el) {
        var optgroup = $(optgroup_el);
        var group = optgroup.attr("label").split("|")[0].trim().replace(/^\d+\./, '');
        
        var productsForGroup = optgroup.find("option").map(function(idx, option_el) {
            var fullname = $(option_el).text();
            var id = $(option_el).val();
            // Cols [2.50 €/unitat-manat] (Ca l'Obaguer) El Rostoll
            // Tomàquets [2.00 €/kg] (Ca l'Obaguer) El Rostoll
            var matches = fullname.match(/^(.*) \[(.*) (.*)\] \((.*)\) (.*)$/).slice(1);
            
            if (!matches) {
                alert("Cannot parse product: " + fullname);
            } else {
                var name = matches[0], 
                    price = matches[1], 
                    type_string = matches[2], 
                    group_short_name = matches[3],
                    type = (type_string == "€/kg") ? "weight" : "units";
                
                return {
                  id: id, 
                  name: name, 
                  group: group,
                  price: parseFloat(price), 
                  type: type,
                  price_info: price + " " + type_string
                };
            }
        }).get();
        productsByGroup[group] = productsForGroup;
    });
    
    return productsByGroup;
};

var setTotals = function(model) {
  var total = _
    .chain(model.basket)
    .map(item => item.quantity * model.productsById[item.id].price)
    .reduce((acc, num) => acc + num, 0)
    .value();
  var total_with_increment = total * (1 + (model.percentageCoope / 100.0));
  
  $(".totalbox .total").val(total.toFixed(2));
  $(".totalbox .totalinc").val(total_with_increment.toFixed(2));
};

var getNewBasket = function(model, product, quantity) {
  var subtotal = parseFloat(product.price) * parseFloat(quantity);
  var basketById = _.indexBy(model.basket, "id");
  var itemAlreadyInBasket = !!basketById[product.id];
  var newBasket;
  
  if (quantity > 0) {
    if (itemAlreadyInBasket) {
      newBasket = _.map(model.basket, item => 
        item.id == product.id ? {id: item.id, quantity: quantity} : item);
    } else {
      newBasket = _.sortBasketItems(
        model.basket.concat([{id: product.id, quantity: quantity}]),
        _.keys(model.productsByGroup),
        model.productsById
      );
    }
  } else {
    newBasket = _.reject(model.basket, item => item.id == product.id);  
  }
  
  return _.extend({}, model, {basket: newBasket});
};

var onProductQuantityStep = function(ev, model, product, step, direction) {
  var s = $(ev.target).parents("a").siblings("input").val();
  if (!s)
    return model;
  var value = parseFloat(s);
  var quantity = value - (value % step) + (direction == "up" ? step : -step);
  return getNewBasket(model, product, quantity);
}

var onProductQuantityChange = function(ev, model, product) {
  var quantity = Math.max($(ev.target).val(), 0);
  return getNewBasket(model, product, quantity);
};

var onBasketRemove = function(ev, model, product) {
  ev.preventDefault();
  var newBasket = _.reject(model.basket, item => item.id == product.id);
  return _.extend({}, model, {basket: newBasket});
}

var render = function(model, event) {
  window.model = model;
  _.defer(() => {
    $("#products-selector").accordion({heightStyle: "fill"});
    //$("#products-selector").accordion({heightStyle: "content"});
    //$("#products-selector").accordion({heightStyle: "auto"});
  });
    
  $("#id_form-TOTAL_FORMS").val(model.basket.length);
  setTotals(model);

  var productsView = renderProducts(model, event);
  var basketView = renderBasket(model, event);
  return html("div", {id: "box"}, [productsView, basketView]);
};

var getQuantityInput = function(form_index, event, product, quantity) {
  var fname = form_index != null ? "form-" + form_index.toString() + "-quantitat" : undefined;
  var step = getStep(product);
  
  return {
    "value": quantity, 
    "name": fname,
    "className": "quantity",
    "min": 0,
    "step": step == 1 ? step : "any",
    "type": "number",
    "onchange": event(onProductQuantityChange, product)
  };
};

var getStep = function(product) {
  return (product.type == "weight") ? 1 : 1;
};

var renderQuantityInput = function(product, productIndex, quantity, event) {
  var step = getStep(product);
  
  return (
    html("span", {className: "ui-spinner ui-widget ui-widget-content ui-corner-all"}, [
      html("input", getQuantityInput(productIndex, event, product, quantity)),
      html("a", {className: "ui-spinner-button ui-spinner-up ui-corner-tr " + 
                            "ui-button ui-widget ui-state-default ui-button-text-only", 
                 tabindex: "-1", role: "button",
                 onclick: event(onProductQuantityStep, product, step, "up")}, [
        html("span", {className: "ui-button-text"}, [
          html("span", {className: "ui-icon ui-icon-triangle-1-n"}, ["▲"])
        ]),
      ]),
      html("a", {className: "ui-spinner-button ui-spinner-down ui-corner-br ui-button " + 
                            "ui-widget ui-state-default ui-button-text-only", 
                 tabindex: "-1", role: "button",
                 onclick: event(onProductQuantityStep, product, step, "down")}, [
        html("span", {className: "ui-button-text"}, [
          html("span", {className: "ui-icon ui-icon-triangle-1-s"}, ["▼"])
        ]),
      ]),
    ])
  );
};

var onGroupClicked = function(ev, model, group) {
  ev.preventDefault();
  var newOpenIndex = _.keys(model.productsByGroup).indexOf(group)
  $("#products-selector").accordion("option", "active", newOpenIndex);
  return model;
};

var renderBasket = function(model, event) {
  var rows = _
    .chain(model.basket)
    .map((basketItem, productIndex) => {
      var quantity = basketItem.quantity;
      var product = model.productsById[basketItem.id];
      
      var subtotal = product.price * quantity;
      var fname = "form-" + productIndex;
      
      return ( 
        html("li", {}, [
          html("span", {className: "product-name"}, [
            html("a", {href: "#", onclick: event(onGroupClicked, product.group)}, [product.group]),
            html("span", {}, [" - " + product.name + " [" + product.price_info + "]"])
          ]),
          html("input", {name: fname + "-producte", type: "hidden", value: product.id}),
          renderQuantityInput(product, productIndex, quantity, event),
          html("span", {className: "subtotal", id: fname + "-producte-subtotal", 
                         type: "number", readonly: ""}, [subtotal.toFixed(2) + " €"]),
          html("a", {href: "#", className: "remove", 
                     onclick: event(onBasketRemove, product)}, ["X"]),
        ])
      );
    })
    .value();
    
  var header = html("h3", {}, "Cistella de la compra");
  var rows2 = _.isEmpty(rows) ? [html("span", {}, ["La cistella està buida"])] : rows;
  return html("ol", {id: "basket"}, [header].concat(rows2));
};

var renderProducts = function(model, event) {
  var productsByGroup = model.productsByGroup;
  var quantitiesByProductId = _.chain(model.basket)
    .map(item => [item.id, item.quantity]).object().value();
  
  return (
    html("div", {"id": "products"}, [
      html("h3", {}, ["Productes"]),
      html("div", {"id": "products-selector"}, _(productsByGroup).map((productsForGroup, group) =>
        [      
          html("div", {}, [group]), 
          html("ul", {}, productsForGroup.map(product => {
            var fname = "form-" + product.id;
            var quantity = quantitiesByProductId[product.id] || 0.0;
            var subtotal = product.price * quantity;
            
            return html("li", {}, [
              html("span", {"className": "product-name"}, 
                [product.name + " [" + product.price_info + "]"]),
              renderQuantityInput(product, null, quantity, event),
              html("span", {"className": "subtotal", 
                            "id": fname + "-producte-subtotal", 
                            "type": "number",
                            "value": subtotal.toFixed(2),
                            "readonly": true}, [subtotal.toFixed(2) + " €"]),
              quantity > 0 ? html("a", {href: "#", className: "remove", 
                         onclick: event(onBasketRemove, product)}, ["X"]) : null,
            ]);
          }))
        ]
      ))
    ])
  );
};

var init = function() {
  var percentageMatch = document.documentElement.outerHTML
    .match(/\$\('\.totalinc'\).*\(1\+\((.*)\)\/100\)/);
  if (!percentageMatch)
    return;
    
  var percentageCoope = percentageMatch[1];
  var productsByGroup = getAllProductsByGroup();
  var productsById = _.chain(productsByGroup)
    .values().flatten(true).indexBy("id").value();
  var oldBasket = getPreviousBasket(_.keys(productsByGroup), productsById);

  var initialModel = {
    productsByGroup: productsByGroup,
    productsById: productsById,
    percentageCoope: percentageCoope,
    basket: oldBasket
  };
  
  $(".totalbox").slice(0, 2).remove();
  $("#comanda .detall_form").remove();
  $(document.body).on("mouseenter", ".ui-spinner-button", 
    function() { $(this).addClass("ui-state-hover"); });
  $(document.body).on("mouseleave", ".ui-spinner-button",
    function() { $(this).removeClass("ui-state-hover"); });

  $("#id_form-MAX_NUM_FORMS").after($("<div>", {id: "app"}))
  var component = Component($("#app").get(0), initialModel, render);
};

$(document.body).ready(init);
