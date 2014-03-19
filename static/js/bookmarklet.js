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

  var HOST = '127.0.0.1:5000';

  function absUrl(relativeUrl) {
    return '//' + HOST + relativeUrl;
  }

  function clipUrl(url) {
    $.ajax(absUrl('/clip'), {
      data: {url: url},
      dataType: 'jsonp'
    }).done(function(response){
      console.log("response: " + response);
    });
  }

  clipUrl(window.location.href);

  });
