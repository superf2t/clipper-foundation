(function(e,a,g,h,f,c,b,d){
  if(!(f=e.jQuery)||g>f.fn.jquery||h(f)){
    c=a.createElement("script");
    c.type="text/javascript";
    c.src="http://ajax.googleapis.com/ajax/libs/jquery/"+g+"/jquery.min.js";
    c.onload=c.onreadystatechange=function(){
      if(!b&&(!(d=this.readyState)||d=="loaded"||d=="complete")){
        h((f=e.jQuery).noConflict(1),b=1);
        f(c).remove()}
      };
      //a.documentElement.childNodes[0].appendChild(c);
      document.body.appendChild(c);
    }
  })(window,document,"1.10.0",function($,L){

  //var HOST = '127.0.0.1:5000';
  var HOST = 'kauaitrip.ngrok.com';

  function absUrl(relativeUrl) {
    return '//' + HOST + relativeUrl;
  }

  function clipUrl(url) {
    if (window['__tcOverlay']) {
      window['__tcOverlay'].remove();
    }
    $.ajax(absUrl('/clip'), {
      data: {url: url},
      dataType: 'jsonp'
    }).done(function(response) {
      var handlerActive = true;
      window['__tcSpinner'].remove();
      var div = window['__tcOverlay'] = $(response['html']);
      $(document.body).append(div);
      $(document.body).on('click', function(event) {
        if (!handlerActive) return;
        if (!div.has(event.target).exists()) {
          handlerActive = false;
          div.remove();
          div = null;
        }
      })
    });
  }

  function showSpinner() {
    var spinnerDiv = $('<div>').css({
      position: 'fixed',
      top: 50,
      right: 50,
      zIndex: 10000
    }).append($('<img>').attr('src', absUrl('/static/img/spinner.gif')));
    window['__tcSpinner'] = spinnerDiv;
    $(document.body).append(spinnerDiv);
  }

  showSpinner();
  clipUrl(window.location.href);

  });
