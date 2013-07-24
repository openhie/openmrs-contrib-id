var hbs = require('hbs'); // Get the global HBS instance.

hbs.registerHelper('email_verification', function(emailObj, type) {
    switch(type) {
        case 'class':
            if (emailObj.helper || emailObj.verified)
                return null;
            else {
                return 'inprogress';
            }
    }
});

hbs.registerHelper('if_inprogress', function(emailObj, context) {
    if (emailObj.verified === false)
        return context.fn(this);
});