var _ = require('underscore'),
    log = require('../../logger').add('viewengine/helpers'),
    blocks = require('./blocks');

module.exports = {
    register: function(hbs) {
        var SS = hbs.handlebars.SafeString; // SafeString aliased for simplicity

        // Extend with our own helpers. We define them now because we can
        // reference the `hbs` object.

        // `block` defines an area in a layout template that where content
        // can be inserted, `extend` inserts content from a child template.
        hbs.registerHelper('extend', function(name, context) {
            var renderedContext = context.fn(this);

            log.trace('Extending a block "' + name + '" with context:\n' + renderedContext);

            // Get or create a storage array for this block.
            var block = blocks[name] ? blocks[name] : blocks[name] = [];

            // Render the block and push it into the queue.
            block.push(renderedContext);
        });

        hbs.registerHelper('block', function(name, context) {
            var block = blocks[name] ? blocks[name] : blocks[name] = [],
                val = null;

            log.trace('Rendering ' + block.length + ' entries for block "' + name + '"');

            // If any content is set for this block (from an `extend` call),
            // set it as the block's value. Otherwise, use the markup inside
            // the `block` tag itself.
            if (block.length)
                val = block.join('\n');
            else if (context.fn)
                val = context.fn(this);

            // Clear the block for next render.
            blocks[name] = [];
            if (val)
                return new SS(val);
        });

        // {{#n}} replaces newlines with spaces in its content. Useful when
        // writing complex <input> tags and the like.
        hbs.registerHelper('n', function(context) {
            var val = context.fn(this);
            val = val.replace(/  +/g, ' ');
            val = val.replace(/\n/g, ' ');
            return val;
        });

        hbs.registerHelper('sidebarItem', function(name) {
            var s = hbs.handlebars.partials[name] || "Sidebar item not loaded";
            return new SS(hbs.handlebars.compile(s)());
        });

        // TODO: Validation helpers should be moved to the validation module.

        // Outputs either a css class or an HTML `value` attribute
        // if the item exists. Use additional paramaters to specify an
        // alternate output, e.g. `{{check "value" fail.uid or "you"}}`
        hbs.registerHelper('check', function(type, firstItem) {

            var items = [firstItem];

            // Add all alternates to `items`.
            var args = Array.prototype.slice.call(arguments);
            args.forEach(function(a, i) {
                if (a === 'or')
                    items.push(args[i+1]);
            });

            log.trace('"check" helper - possible items are: ' +
                JSON.stringify(items));

            for (var i in items) {
                if (items[i]) switch (type) {
                    case "class":
                        return "fail";
                    case "valid":
                        return "valid";
                    case "progress":
                        return "inprogress";
                    case "value":
                        var val = items[i].value || items[i];
                        return new SS('value="' + val + '"');
                }
            }
        });

        // Prints "failtext" for a specific form field by reading the `fail`
        // object's data.
        hbs.registerHelper('explanation', function() {
            var elseText = _.last(arguments),
                items = _.initial(arguments),
                str = '';

            items.forEach(function(i) {
                if (i && i.reason)
                    str += i.reason + ' ';
            });

            if (!str)
                str = elseText.fn(this);

            return new SS('<span class="failtext">' + str + '</span> ');
        });
    }
};