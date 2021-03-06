// Write your package code here!

// Reactive dict that doesn't serialize anything
var SimpleReactiveDict = function () {
  var keys = {};
  var deps = {};

  var ensureDeps = function(key) {
    if(!deps[key]) {
      deps[key] = new Deps.Dependency();
    }
  };

  return {
    set: function(key, value) {
      ensureDeps(key);
      keys[key] = value;
      deps[key].changed();
    },

    get: function(key) {
      ensureDeps(key);
      deps[key].depend();
      return keys[key];
    }
  };
};

Component = {};

var ComponentInstance = function (templateInst) {
  var self = this;

  // XXX init a bunch of stuff
  
  var subHandles = new ReactiveVar([]);
  self.subscribe = function (/* subscription args */) {
    var handle = Meteor.subscribe.apply(Meteor, arguments);
    subHandles.set(subHandles.get().concat(handle));
    return handle;
  };

  self._unsubAll = function () {
    _.each(subHandles, function (handle) {
      handle.stop();
    });
  };

  self.ready = function () {
    return _.all(subHandles.get(), function (handle) {
      return handle.ready();
    });
  };

  self.autorun = _.bind(templateInst.autorun, templateInst);

  // XXX if we can somehow generate a unique ID for this, we could use
  // reactive dict to persist on HCP
  self.state = new SimpleReactiveDict();

  // XXX wrap read-write and read-only args appropriately
  self.args = new SimpleReactiveDict();
  var updateArg = _.bind(self.args.set, self.args);
  self.args.set = function () {
    throw new Error("Cannot currently set an argument.");
  };

  self.autorun(function () {
    // The data context is the template arguments. Might need some hack to
    // XXX distinguish keyword args from old-school data context
    var args = Template.currentData();

    // XXX be reactive in the opposite direction so that we can communicate
    // to parents
    _.each(args, function (argVal, argName) {
      if (argVal instanceof ReactiveVar) {
        updateArg(argName, argVal.get());
      } else {
        updateArg(argName, argVal);
      }
    });
  });

  // XXX bind all methods?
  self.find = _.bind(templateInst.find, templateInst);
  self.$ = _.bind(templateInst.$, templateInst);
};

Component.define = function (template, definition) {
  // XXX need more protection against changing things like helpers/events
  definition = _.clone(definition);

  // Assign all the callbacks to the template and bind them to component
  // instance
  template.created = function () {
    var templateInst = this;
    templateInst._component = new ComponentInstance(templateInst);
    if (definition.created) {
      definition.created.call(templateInst._component);
    }
  };

  template.rendered = function () {
    var templateInst = this;
    if (definition.rendered) {
      definition.rendered.call(templateInst._component);
    }
  };

  template.destroyed = function () {
    var templateInst = this;
    if (definition.destroyed) {
      definition.destroyed.call(templateInst._component);
      templateInst._component._unsubAll();
    }
  };

  // Assign events
  var boundEvents = {};

  // XXX can't pass in arguments? use data- instead?
  _.each(definition.events, function (handler, eventDescriptor) {
    // Bind events to the component instance
    boundEvents[eventDescriptor] = function (event, templateInst) {
      return handler.call(templateInst._component, event);
    };
  });

  template.events(boundEvents);

  // Assign helpers
  var boundHelpers = {};

  // XXX cache helpers since they don't depend on the data context anymore
  _.each(definition.helpers, function (helper, helperName) {
    boundHelpers[helperName] = function (/* helper args */) {
      return helper.apply(Template.instance()._component, arguments);
    };
  });

  // Assign methods as helpers
  _.each(definition.methods, function (callback, callbackName) {
    if (boundHelpers[callbackName]) {
      console.log("Can't attach a method named the same as a helper.");
    } else {
      boundHelpers[callbackName] = function () {
        return _.bind(callback, templateInst);
      };
    }
  });

  template.helpers(boundHelpers);

  // Assign helpers to get state/args
  template.helpers({
    args: function (argName) {
      return Template.instance()._component.args.get(argName);
    },
    state: function (stateVarName) {
      return Template.instance()._component.state.get(stateVarName);
    }
  });
};