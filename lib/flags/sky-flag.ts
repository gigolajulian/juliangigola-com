/* `data-sky` on <html>: the time picker in the hour's light (lib/booking/sky.ts). On for everyone since
   2026-11-24; `?sky=0` turns it off for the tab (the old picker, kept as the way back), `?sky` on again. */
export const SKY_HEAD = `(function(){try{var k="jg-sky",v=location.search.match(/[?&]sky(?:=([01]))?(?:&|$)/);if(v)sessionStorage.setItem(k,v[1]==="0"?"0":"1");if(sessionStorage.getItem(k)==="0")return}catch(e){}document.documentElement.dataset.sky=""})()`;

/** Whether the tab has the sky picker on (client only). */
export const skyOn = () => typeof document !== "undefined" && "sky" in document.documentElement.dataset;
