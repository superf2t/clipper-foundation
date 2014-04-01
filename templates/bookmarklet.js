(function(e,a,g,h,f,c,b,d){
  c=a.createElement("script");
  c.type="text/javascript";
  c.src="//ajax.googleapis.com/ajax/libs/jquery/"+g+"/jquery.min.js";
  c.onload=c.onreadystatechange=function(){
    if(!b&&(!(d=this.readyState)||d=="loaded"||d=="complete")){
      h((f=e.jQuery).noConflict(1),b=1);
      f(c).remove()}
    };
    document.body.appendChild(c);
  })(window,document,"1.11.0",function($,L){

  window['__tc$'] = $;
  var HOST = '{{host}}';

  function absUrl(relativeUrl) {
    return 'https://' + HOST + relativeUrl;
  }

  function clipUrl(url) {
    clearOverlay();
    $.ajax(absUrl('/clip'), {
      data: {url: url},
      dataType: 'jsonp'
    }).done(handleResponse);
  }

  function clearOverlay() {
    if (window['__tcOverlay']) {
      window['__tcOverlay'].remove();
    }
  }

  function handleResponse(response) {
    var handlerActive = true;
    window['__tcSpinner'].remove();
    var div = window['__tcOverlay'] = $(response['html']);
    $(document.body).append(div);
    $(document.body).on('click', function(event) {
      if (!handlerActive) return;
      if (!div.has(event.target).length) {
        handlerActive = false;
        div.remove();
        div = null;
      }
    });
  }

  function showSpinner() {
    var spinnerDiv = $('<div>').css({
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 10000,
      width: 300,
      height: 200,
      padding: 10,
      backgroundColor: '#FFFFFF',
      opacity: 0.9,
      borderRadius: 4      
    }).append($('<img>').attr('src', absUrl('/static/img/spinner.gif')).css({
      position: 'relative',
      top: 25,
      left: 50
    }));
    window['__tcSpinner'] = spinnerDiv;
    $(document.body).append(spinnerDiv);
  }

  showSpinner();
  clipUrl(window.location.href);

  });
