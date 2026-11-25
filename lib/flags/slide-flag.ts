/* `data-slide` on <html>: the booking steps move right to left (cards to calendar, and step to step), on trial.
   `?slide` turns it on for the tab, `?slide=0` off. Off by default until Julian says ship. */
export const SLIDE_HEAD = `(function(){try{var k="jg-slide",v=location.search.match(/[?&]slide(?:=([01]))?(?:&|$)/);if(v)sessionStorage.setItem(k,v[1]==="0"?"":"1");if(sessionStorage.getItem(k))document.documentElement.dataset.slide=""}catch(e){}})()`;
