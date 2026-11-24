/* `data-sky` on <html>: the time picker in the hour's light (lib/booking/sky.ts), on trial. `?sky` turns it on
   for the tab, `?sky=0` off. Off by default until Julian says ship. */
export const SKY_HEAD = `(function(){try{var k="jg-sky",v=location.search.match(/[?&]sky(?:=([01]))?(?:&|$)/);if(v)sessionStorage.setItem(k,v[1]==="0"?"":"1");if(sessionStorage.getItem(k))document.documentElement.dataset.sky=""}catch(e){}})()`;

/** Whether the tab has the sky picker on (client only). */
export const skyOn = () => typeof document !== "undefined" && "sky" in document.documentElement.dataset;
