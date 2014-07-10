// Fills out the login form automatically
// Create a bookmarklet by pasting this in a tool like
// http://ted.mielczarek.org/code/mozilla/bookmarklet.html
var doc = $('iframe').length ? $($('iframe')[0].contentDocument) : $(document);
var rand = parseInt(Math.random() * 1000);
doc.find('#email').val('jonathan+tc' + rand + '@unicyclelabs.com');
doc.find('#first_name').val('Art');
doc.find('#last_name').val('Vandelay');
doc.find('#display_name').val('Art V');
doc.find('#password').val('Foo123');
doc.find('#retype_password').val('Foo123');
