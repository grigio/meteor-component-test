if (Meteor.isClient) {

  // counter_factory component
  Component.define(Template.counter_factory, {
    created: function () {
      this.shared = new ReactiveDict();
      this.shared.set('counter', 40);
    },
    helpers: {
      length:function () {
        return this.shared.get('counter');
      }
    },
    events: {
      'click [data-standalone]': function () {
        Blaze.renderWithData(Template.counter, {}, document.body);
      },
      'click [data-shared]': function () {
        Blaze.renderWithData(Template.counter, {sharedCount:this.shared}, document.body);
      }
    }
  });

  // counter component (counter data can be standalone or shared with other components)
  Component.define(Template.counter, {
    created: function () {
      var self = this;

      // use shared counter if available
      if (Template.instance().data && Template.instance().data.sharedCount)
        self.state = Template.instance().data.sharedCount;
      else
        self.state.set("counter", 0);
    },
    helpers: {
      counter: function () {
        return this.state.get("counter");
      }
    },
    events: {
      'click button': function () {
        // increment the counter when button is clicked
        this.state.set("counter", this.state.get("counter") + 1);
      }
    }
  });


}