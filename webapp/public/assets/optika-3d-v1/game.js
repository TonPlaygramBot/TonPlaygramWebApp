(()=>{var iM=Object.create;var mh=Object.defineProperty;var rM=Object.getOwnPropertyDescriptor;var sM=Object.getOwnPropertyNames;var oM=Object.getPrototypeOf,aM=Object.prototype.hasOwnProperty;var lM=(n,e,t)=>e in n?mh(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var Ri=(n,e)=>()=>{try{return e||n((e={exports:{}}).exports,e),e.exports}catch(t){throw e=0,t}};var cM=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of sM(e))!aM.call(n,r)&&r!==t&&mh(n,r,{get:()=>e[r],enumerable:!(i=rM(e,r))||i.enumerable});return n};var Ms=(n,e,t)=>(t=n!=null?iM(oM(n)):{},cM(e||!n||!n.__esModule?mh(t,"default",{value:n,enumerable:!0}):t,n));var Z=(n,e,t)=>lM(n,typeof e!="symbol"?e+"":e,t);var tg=Ri(Ze=>{"use strict";var Yo=Symbol.for("react.element"),uM=Symbol.for("react.portal"),hM=Symbol.for("react.fragment"),dM=Symbol.for("react.strict_mode"),fM=Symbol.for("react.profiler"),pM=Symbol.for("react.provider"),mM=Symbol.for("react.context"),gM=Symbol.for("react.forward_ref"),vM=Symbol.for("react.suspense"),yM=Symbol.for("react.memo"),_M=Symbol.for("react.lazy"),Xm=Symbol.iterator;function xM(n){return n===null||typeof n!="object"?null:(n=Xm&&n[Xm]||n["@@iterator"],typeof n=="function"?n:null)}var jm={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},Km=Object.assign,Zm={};function Ss(n,e,t){this.props=n,this.context=e,this.refs=Zm,this.updater=t||jm}Ss.prototype.isReactComponent={};Ss.prototype.setState=function(n,e){if(typeof n!="object"&&typeof n!="function"&&n!=null)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,n,e,"setState")};Ss.prototype.forceUpdate=function(n){this.updater.enqueueForceUpdate(this,n,"forceUpdate")};function $m(){}$m.prototype=Ss.prototype;function vh(n,e,t){this.props=n,this.context=e,this.refs=Zm,this.updater=t||jm}var yh=vh.prototype=new $m;yh.constructor=vh;Km(yh,Ss.prototype);yh.isPureReactComponent=!0;var qm=Array.isArray,Jm=Object.prototype.hasOwnProperty,_h={current:null},Qm={key:!0,ref:!0,__self:!0,__source:!0};function eg(n,e,t){var i,r={},s=null,o=null;if(e!=null)for(i in e.ref!==void 0&&(o=e.ref),e.key!==void 0&&(s=""+e.key),e)Jm.call(e,i)&&!Qm.hasOwnProperty(i)&&(r[i]=e[i]);var a=arguments.length-2;if(a===1)r.children=t;else if(1<a){for(var l=Array(a),c=0;c<a;c++)l[c]=arguments[c+2];r.children=l}if(n&&n.defaultProps)for(i in a=n.defaultProps,a)r[i]===void 0&&(r[i]=a[i]);return{$$typeof:Yo,type:n,key:s,ref:o,props:r,_owner:_h.current}}function MM(n,e){return{$$typeof:Yo,type:n.type,key:e,ref:n.ref,props:n.props,_owner:n._owner}}function xh(n){return typeof n=="object"&&n!==null&&n.$$typeof===Yo}function SM(n){var e={"=":"=0",":":"=2"};return"$"+n.replace(/[=:]/g,function(t){return e[t]})}var Ym=/\/+/g;function gh(n,e){return typeof n=="object"&&n!==null&&n.key!=null?SM(""+n.key):e.toString(36)}function _l(n,e,t,i,r){var s=typeof n;(s==="undefined"||s==="boolean")&&(n=null);var o=!1;if(n===null)o=!0;else switch(s){case"string":case"number":o=!0;break;case"object":switch(n.$$typeof){case Yo:case uM:o=!0}}if(o)return o=n,r=r(o),n=i===""?"."+gh(o,0):i,qm(r)?(t="",n!=null&&(t=n.replace(Ym,"$&/")+"/"),_l(r,e,t,"",function(c){return c})):r!=null&&(xh(r)&&(r=MM(r,t+(!r.key||o&&o.key===r.key?"":(""+r.key).replace(Ym,"$&/")+"/")+n)),e.push(r)),1;if(o=0,i=i===""?".":i+":",qm(n))for(var a=0;a<n.length;a++){s=n[a];var l=i+gh(s,a);o+=_l(s,e,t,l,r)}else if(l=xM(n),typeof l=="function")for(n=l.call(n),a=0;!(s=n.next()).done;)s=s.value,l=i+gh(s,a++),o+=_l(s,e,t,l,r);else if(s==="object")throw e=String(n),Error("Objects are not valid as a React child (found: "+(e==="[object Object]"?"object with keys {"+Object.keys(n).join(", ")+"}":e)+"). If you meant to render a collection of children, use an array instead.");return o}function yl(n,e,t){if(n==null)return n;var i=[],r=0;return _l(n,i,"","",function(s){return e.call(t,s,r++)}),i}function wM(n){if(n._status===-1){var e=n._result;e=e(),e.then(function(t){(n._status===0||n._status===-1)&&(n._status=1,n._result=t)},function(t){(n._status===0||n._status===-1)&&(n._status=2,n._result=t)}),n._status===-1&&(n._status=0,n._result=e)}if(n._status===1)return n._result.default;throw n._result}var dn={current:null},xl={transition:null},EM={ReactCurrentDispatcher:dn,ReactCurrentBatchConfig:xl,ReactCurrentOwner:_h};Ze.Children={map:yl,forEach:function(n,e,t){yl(n,function(){e.apply(this,arguments)},t)},count:function(n){var e=0;return yl(n,function(){e++}),e},toArray:function(n){return yl(n,function(e){return e})||[]},only:function(n){if(!xh(n))throw Error("React.Children.only expected to receive a single React element child.");return n}};Ze.Component=Ss;Ze.Fragment=hM;Ze.Profiler=fM;Ze.PureComponent=vh;Ze.StrictMode=dM;Ze.Suspense=vM;Ze.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=EM;Ze.cloneElement=function(n,e,t){if(n==null)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+n+".");var i=Km({},n.props),r=n.key,s=n.ref,o=n._owner;if(e!=null){if(e.ref!==void 0&&(s=e.ref,o=_h.current),e.key!==void 0&&(r=""+e.key),n.type&&n.type.defaultProps)var a=n.type.defaultProps;for(l in e)Jm.call(e,l)&&!Qm.hasOwnProperty(l)&&(i[l]=e[l]===void 0&&a!==void 0?a[l]:e[l])}var l=arguments.length-2;if(l===1)i.children=t;else if(1<l){a=Array(l);for(var c=0;c<l;c++)a[c]=arguments[c+2];i.children=a}return{$$typeof:Yo,type:n.type,key:r,ref:s,props:i,_owner:o}};Ze.createContext=function(n){return n={$$typeof:mM,_currentValue:n,_currentValue2:n,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null},n.Provider={$$typeof:pM,_context:n},n.Consumer=n};Ze.createElement=eg;Ze.createFactory=function(n){var e=eg.bind(null,n);return e.type=n,e};Ze.createRef=function(){return{current:null}};Ze.forwardRef=function(n){return{$$typeof:gM,render:n}};Ze.isValidElement=xh;Ze.lazy=function(n){return{$$typeof:_M,_payload:{_status:-1,_result:n},_init:wM}};Ze.memo=function(n,e){return{$$typeof:yM,type:n,compare:e===void 0?null:e}};Ze.startTransition=function(n){var e=xl.transition;xl.transition={};try{n()}finally{xl.transition=e}};Ze.unstable_act=function(){throw Error("act(...) is not supported in production builds of React.")};Ze.useCallback=function(n,e){return dn.current.useCallback(n,e)};Ze.useContext=function(n){return dn.current.useContext(n)};Ze.useDebugValue=function(){};Ze.useDeferredValue=function(n){return dn.current.useDeferredValue(n)};Ze.useEffect=function(n,e){return dn.current.useEffect(n,e)};Ze.useId=function(){return dn.current.useId()};Ze.useImperativeHandle=function(n,e,t){return dn.current.useImperativeHandle(n,e,t)};Ze.useInsertionEffect=function(n,e){return dn.current.useInsertionEffect(n,e)};Ze.useLayoutEffect=function(n,e){return dn.current.useLayoutEffect(n,e)};Ze.useMemo=function(n,e){return dn.current.useMemo(n,e)};Ze.useReducer=function(n,e,t){return dn.current.useReducer(n,e,t)};Ze.useRef=function(n){return dn.current.useRef(n)};Ze.useState=function(n){return dn.current.useState(n)};Ze.useSyncExternalStore=function(n,e,t){return dn.current.useSyncExternalStore(n,e,t)};Ze.useTransition=function(){return dn.current.useTransition()};Ze.version="18.2.0"});var Ml=Ri((CC,ng)=>{"use strict";ng.exports=tg()});var dg=Ri(ht=>{"use strict";function Eh(n,e){var t=n.length;n.push(e);e:for(;0<t;){var i=t-1>>>1,r=n[i];if(0<Sl(r,e))n[i]=e,n[t]=r,t=i;else break e}}function Qn(n){return n.length===0?null:n[0]}function El(n){if(n.length===0)return null;var e=n[0],t=n.pop();if(t!==e){n[0]=t;e:for(var i=0,r=n.length,s=r>>>1;i<s;){var o=2*(i+1)-1,a=n[o],l=o+1,c=n[l];if(0>Sl(a,t))l<r&&0>Sl(c,a)?(n[i]=c,n[l]=t,i=l):(n[i]=a,n[o]=t,i=o);else if(l<r&&0>Sl(c,t))n[i]=c,n[l]=t,i=l;else break e}}return e}function Sl(n,e){var t=n.sortIndex-e.sortIndex;return t!==0?t:n.id-e.id}typeof performance=="object"&&typeof performance.now=="function"?(ig=performance,ht.unstable_now=function(){return ig.now()}):(Mh=Date,rg=Mh.now(),ht.unstable_now=function(){return Mh.now()-rg});var ig,Mh,rg,pi=[],ir=[],TM=1,Hn=null,en=3,Tl=!1,Wr=!1,Ko=!1,ag=typeof setTimeout=="function"?setTimeout:null,lg=typeof clearTimeout=="function"?clearTimeout:null,sg=typeof setImmediate<"u"?setImmediate:null;typeof navigator<"u"&&navigator.scheduling!==void 0&&navigator.scheduling.isInputPending!==void 0&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function Th(n){for(var e=Qn(ir);e!==null;){if(e.callback===null)El(ir);else if(e.startTime<=n)El(ir),e.sortIndex=e.expirationTime,Eh(pi,e);else break;e=Qn(ir)}}function Ah(n){if(Ko=!1,Th(n),!Wr)if(Qn(pi)!==null)Wr=!0,Rh(bh);else{var e=Qn(ir);e!==null&&Ch(Ah,e.startTime-n)}}function bh(n,e){Wr=!1,Ko&&(Ko=!1,lg(Zo),Zo=-1),Tl=!0;var t=en;try{for(Th(e),Hn=Qn(pi);Hn!==null&&(!(Hn.expirationTime>e)||n&&!hg());){var i=Hn.callback;if(typeof i=="function"){Hn.callback=null,en=Hn.priorityLevel;var r=i(Hn.expirationTime<=e);e=ht.unstable_now(),typeof r=="function"?Hn.callback=r:Hn===Qn(pi)&&El(pi),Th(e)}else El(pi);Hn=Qn(pi)}if(Hn!==null)var s=!0;else{var o=Qn(ir);o!==null&&Ch(Ah,o.startTime-e),s=!1}return s}finally{Hn=null,en=t,Tl=!1}}var Al=!1,wl=null,Zo=-1,cg=5,ug=-1;function hg(){return!(ht.unstable_now()-ug<cg)}function Sh(){if(wl!==null){var n=ht.unstable_now();ug=n;var e=!0;try{e=wl(!0,n)}finally{e?jo():(Al=!1,wl=null)}}else Al=!1}var jo;typeof sg=="function"?jo=function(){sg(Sh)}:typeof MessageChannel<"u"?(wh=new MessageChannel,og=wh.port2,wh.port1.onmessage=Sh,jo=function(){og.postMessage(null)}):jo=function(){ag(Sh,0)};var wh,og;function Rh(n){wl=n,Al||(Al=!0,jo())}function Ch(n,e){Zo=ag(function(){n(ht.unstable_now())},e)}ht.unstable_IdlePriority=5;ht.unstable_ImmediatePriority=1;ht.unstable_LowPriority=4;ht.unstable_NormalPriority=3;ht.unstable_Profiling=null;ht.unstable_UserBlockingPriority=2;ht.unstable_cancelCallback=function(n){n.callback=null};ht.unstable_continueExecution=function(){Wr||Tl||(Wr=!0,Rh(bh))};ht.unstable_forceFrameRate=function(n){0>n||125<n?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):cg=0<n?Math.floor(1e3/n):5};ht.unstable_getCurrentPriorityLevel=function(){return en};ht.unstable_getFirstCallbackNode=function(){return Qn(pi)};ht.unstable_next=function(n){switch(en){case 1:case 2:case 3:var e=3;break;default:e=en}var t=en;en=e;try{return n()}finally{en=t}};ht.unstable_pauseExecution=function(){};ht.unstable_requestPaint=function(){};ht.unstable_runWithPriority=function(n,e){switch(n){case 1:case 2:case 3:case 4:case 5:break;default:n=3}var t=en;en=n;try{return e()}finally{en=t}};ht.unstable_scheduleCallback=function(n,e,t){var i=ht.unstable_now();switch(typeof t=="object"&&t!==null?(t=t.delay,t=typeof t=="number"&&0<t?i+t:i):t=i,n){case 1:var r=-1;break;case 2:r=250;break;case 5:r=1073741823;break;case 4:r=1e4;break;default:r=5e3}return r=t+r,n={id:TM++,callback:e,priorityLevel:n,startTime:t,expirationTime:r,sortIndex:-1},t>i?(n.sortIndex=t,Eh(ir,n),Qn(pi)===null&&n===Qn(ir)&&(Ko?(lg(Zo),Zo=-1):Ko=!0,Ch(Ah,t-i))):(n.sortIndex=r,Eh(pi,n),Wr||Tl||(Wr=!0,Rh(bh))),n};ht.unstable_shouldYield=hg;ht.unstable_wrapCallback=function(n){var e=en;return function(){var t=en;en=e;try{return n.apply(this,arguments)}finally{en=t}}}});var pg=Ri((IC,fg)=>{"use strict";fg.exports=dg()});var xy=Ri(Un=>{"use strict";var M0=Ml(),Nn=pg();function ie(n){for(var e="https://reactjs.org/docs/error-decoder.html?invariant="+n,t=1;t<arguments.length;t++)e+="&args[]="+encodeURIComponent(arguments[t]);return"Minified React error #"+n+"; visit "+e+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var S0=new Set,ya={};function is(n,e){Gs(n,e),Gs(n+"Capture",e)}function Gs(n,e){for(ya[n]=e,n=0;n<e.length;n++)S0.add(e[n])}var Di=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Jh=Object.prototype.hasOwnProperty,AM=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,mg={},gg={};function bM(n){return Jh.call(gg,n)?!0:Jh.call(mg,n)?!1:AM.test(n)?gg[n]=!0:(mg[n]=!0,!1)}function RM(n,e,t,i){if(t!==null&&t.type===0)return!1;switch(typeof e){case"function":case"symbol":return!0;case"boolean":return i?!1:t!==null?!t.acceptsBooleans:(n=n.toLowerCase().slice(0,5),n!=="data-"&&n!=="aria-");default:return!1}}function CM(n,e,t,i){if(e===null||typeof e>"u"||RM(n,e,t,i))return!0;if(i)return!1;if(t!==null)switch(t.type){case 3:return!e;case 4:return e===!1;case 5:return isNaN(e);case 6:return isNaN(e)||1>e}return!1}function mn(n,e,t,i,r,s,o){this.acceptsBooleans=e===2||e===3||e===4,this.attributeName=i,this.attributeNamespace=r,this.mustUseProperty=t,this.propertyName=n,this.type=e,this.sanitizeURL=s,this.removeEmptyString=o}var $t={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(n){$t[n]=new mn(n,0,!1,n,null,!1,!1)});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(n){var e=n[0];$t[e]=new mn(e,1,!1,n[1],null,!1,!1)});["contentEditable","draggable","spellCheck","value"].forEach(function(n){$t[n]=new mn(n,2,!1,n.toLowerCase(),null,!1,!1)});["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(n){$t[n]=new mn(n,2,!1,n,null,!1,!1)});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(n){$t[n]=new mn(n,3,!1,n.toLowerCase(),null,!1,!1)});["checked","multiple","muted","selected"].forEach(function(n){$t[n]=new mn(n,3,!0,n,null,!1,!1)});["capture","download"].forEach(function(n){$t[n]=new mn(n,4,!1,n,null,!1,!1)});["cols","rows","size","span"].forEach(function(n){$t[n]=new mn(n,6,!1,n,null,!1,!1)});["rowSpan","start"].forEach(function(n){$t[n]=new mn(n,5,!1,n.toLowerCase(),null,!1,!1)});var Wd=/[\-:]([a-z])/g;function Xd(n){return n[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(n){var e=n.replace(Wd,Xd);$t[e]=new mn(e,1,!1,n,null,!1,!1)});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(n){var e=n.replace(Wd,Xd);$t[e]=new mn(e,1,!1,n,"http://www.w3.org/1999/xlink",!1,!1)});["xml:base","xml:lang","xml:space"].forEach(function(n){var e=n.replace(Wd,Xd);$t[e]=new mn(e,1,!1,n,"http://www.w3.org/XML/1998/namespace",!1,!1)});["tabIndex","crossOrigin"].forEach(function(n){$t[n]=new mn(n,1,!1,n.toLowerCase(),null,!1,!1)});$t.xlinkHref=new mn("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(n){$t[n]=new mn(n,1,!1,n.toLowerCase(),null,!0,!0)});function qd(n,e,t,i){var r=$t.hasOwnProperty(e)?$t[e]:null;(r!==null?r.type!==0:i||!(2<e.length)||e[0]!=="o"&&e[0]!=="O"||e[1]!=="n"&&e[1]!=="N")&&(CM(e,t,r,i)&&(t=null),i||r===null?bM(e)&&(t===null?n.removeAttribute(e):n.setAttribute(e,""+t)):r.mustUseProperty?n[r.propertyName]=t===null?r.type===3?!1:"":t:(e=r.attributeName,i=r.attributeNamespace,t===null?n.removeAttribute(e):(r=r.type,t=r===3||r===4&&t===!0?"":""+t,i?n.setAttributeNS(i,e,t):n.setAttribute(e,t))))}var ki=M0.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,bl=Symbol.for("react.element"),Ts=Symbol.for("react.portal"),As=Symbol.for("react.fragment"),Yd=Symbol.for("react.strict_mode"),Qh=Symbol.for("react.profiler"),w0=Symbol.for("react.provider"),E0=Symbol.for("react.context"),jd=Symbol.for("react.forward_ref"),ed=Symbol.for("react.suspense"),td=Symbol.for("react.suspense_list"),Kd=Symbol.for("react.memo"),sr=Symbol.for("react.lazy"),T0=Symbol.for("react.offscreen"),vg=Symbol.iterator;function $o(n){return n===null||typeof n!="object"?null:(n=vg&&n[vg]||n["@@iterator"],typeof n=="function"?n:null)}var St=Object.assign,Ph;function sa(n){if(Ph===void 0)try{throw Error()}catch(t){var e=t.stack.trim().match(/\n( *(at )?)/);Ph=e&&e[1]||""}return`
`+Ph+n}var Ih=!1;function Lh(n,e){if(!n||Ih)return"";Ih=!0;var t=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(e)if(e=function(){throw Error()},Object.defineProperty(e.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(e,[])}catch(c){var i=c}Reflect.construct(n,[],e)}else{try{e.call()}catch(c){i=c}n.call(e.prototype)}else{try{throw Error()}catch(c){i=c}n()}}catch(c){if(c&&i&&typeof c.stack=="string"){for(var r=c.stack.split(`
`),s=i.stack.split(`
`),o=r.length-1,a=s.length-1;1<=o&&0<=a&&r[o]!==s[a];)a--;for(;1<=o&&0<=a;o--,a--)if(r[o]!==s[a]){if(o!==1||a!==1)do if(o--,a--,0>a||r[o]!==s[a]){var l=`
`+r[o].replace(" at new "," at ");return n.displayName&&l.includes("<anonymous>")&&(l=l.replace("<anonymous>",n.displayName)),l}while(1<=o&&0<=a);break}}}finally{Ih=!1,Error.prepareStackTrace=t}return(n=n?n.displayName||n.name:"")?sa(n):""}function PM(n){switch(n.tag){case 5:return sa(n.type);case 16:return sa("Lazy");case 13:return sa("Suspense");case 19:return sa("SuspenseList");case 0:case 2:case 15:return n=Lh(n.type,!1),n;case 11:return n=Lh(n.type.render,!1),n;case 1:return n=Lh(n.type,!0),n;default:return""}}function nd(n){if(n==null)return null;if(typeof n=="function")return n.displayName||n.name||null;if(typeof n=="string")return n;switch(n){case As:return"Fragment";case Ts:return"Portal";case Qh:return"Profiler";case Yd:return"StrictMode";case ed:return"Suspense";case td:return"SuspenseList"}if(typeof n=="object")switch(n.$$typeof){case E0:return(n.displayName||"Context")+".Consumer";case w0:return(n._context.displayName||"Context")+".Provider";case jd:var e=n.render;return n=n.displayName,n||(n=e.displayName||e.name||"",n=n!==""?"ForwardRef("+n+")":"ForwardRef"),n;case Kd:return e=n.displayName||null,e!==null?e:nd(n.type)||"Memo";case sr:e=n._payload,n=n._init;try{return nd(n(e))}catch{}}return null}function IM(n){var e=n.type;switch(n.tag){case 24:return"Cache";case 9:return(e.displayName||"Context")+".Consumer";case 10:return(e._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return n=e.render,n=n.displayName||n.name||"",e.displayName||(n!==""?"ForwardRef("+n+")":"ForwardRef");case 7:return"Fragment";case 5:return e;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return nd(e);case 8:return e===Yd?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if(typeof e=="function")return e.displayName||e.name||null;if(typeof e=="string")return e}return null}function _r(n){switch(typeof n){case"boolean":case"number":case"string":case"undefined":return n;case"object":return n;default:return""}}function A0(n){var e=n.type;return(n=n.nodeName)&&n.toLowerCase()==="input"&&(e==="checkbox"||e==="radio")}function LM(n){var e=A0(n)?"checked":"value",t=Object.getOwnPropertyDescriptor(n.constructor.prototype,e),i=""+n[e];if(!n.hasOwnProperty(e)&&typeof t<"u"&&typeof t.get=="function"&&typeof t.set=="function"){var r=t.get,s=t.set;return Object.defineProperty(n,e,{configurable:!0,get:function(){return r.call(this)},set:function(o){i=""+o,s.call(this,o)}}),Object.defineProperty(n,e,{enumerable:t.enumerable}),{getValue:function(){return i},setValue:function(o){i=""+o},stopTracking:function(){n._valueTracker=null,delete n[e]}}}}function Rl(n){n._valueTracker||(n._valueTracker=LM(n))}function b0(n){if(!n)return!1;var e=n._valueTracker;if(!e)return!0;var t=e.getValue(),i="";return n&&(i=A0(n)?n.checked?"true":"false":n.value),n=i,n!==t?(e.setValue(n),!0):!1}function nc(n){if(n=n||(typeof document<"u"?document:void 0),typeof n>"u")return null;try{return n.activeElement||n.body}catch{return n.body}}function id(n,e){var t=e.checked;return St({},e,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:t??n._wrapperState.initialChecked})}function yg(n,e){var t=e.defaultValue==null?"":e.defaultValue,i=e.checked!=null?e.checked:e.defaultChecked;t=_r(e.value!=null?e.value:t),n._wrapperState={initialChecked:i,initialValue:t,controlled:e.type==="checkbox"||e.type==="radio"?e.checked!=null:e.value!=null}}function R0(n,e){e=e.checked,e!=null&&qd(n,"checked",e,!1)}function rd(n,e){R0(n,e);var t=_r(e.value),i=e.type;if(t!=null)i==="number"?(t===0&&n.value===""||n.value!=t)&&(n.value=""+t):n.value!==""+t&&(n.value=""+t);else if(i==="submit"||i==="reset"){n.removeAttribute("value");return}e.hasOwnProperty("value")?sd(n,e.type,t):e.hasOwnProperty("defaultValue")&&sd(n,e.type,_r(e.defaultValue)),e.checked==null&&e.defaultChecked!=null&&(n.defaultChecked=!!e.defaultChecked)}function _g(n,e,t){if(e.hasOwnProperty("value")||e.hasOwnProperty("defaultValue")){var i=e.type;if(!(i!=="submit"&&i!=="reset"||e.value!==void 0&&e.value!==null))return;e=""+n._wrapperState.initialValue,t||e===n.value||(n.value=e),n.defaultValue=e}t=n.name,t!==""&&(n.name=""),n.defaultChecked=!!n._wrapperState.initialChecked,t!==""&&(n.name=t)}function sd(n,e,t){(e!=="number"||nc(n.ownerDocument)!==n)&&(t==null?n.defaultValue=""+n._wrapperState.initialValue:n.defaultValue!==""+t&&(n.defaultValue=""+t))}var oa=Array.isArray;function Fs(n,e,t,i){if(n=n.options,e){e={};for(var r=0;r<t.length;r++)e["$"+t[r]]=!0;for(t=0;t<n.length;t++)r=e.hasOwnProperty("$"+n[t].value),n[t].selected!==r&&(n[t].selected=r),r&&i&&(n[t].defaultSelected=!0)}else{for(t=""+_r(t),e=null,r=0;r<n.length;r++){if(n[r].value===t){n[r].selected=!0,i&&(n[r].defaultSelected=!0);return}e!==null||n[r].disabled||(e=n[r])}e!==null&&(e.selected=!0)}}function od(n,e){if(e.dangerouslySetInnerHTML!=null)throw Error(ie(91));return St({},e,{value:void 0,defaultValue:void 0,children:""+n._wrapperState.initialValue})}function xg(n,e){var t=e.value;if(t==null){if(t=e.children,e=e.defaultValue,t!=null){if(e!=null)throw Error(ie(92));if(oa(t)){if(1<t.length)throw Error(ie(93));t=t[0]}e=t}e==null&&(e=""),t=e}n._wrapperState={initialValue:_r(t)}}function C0(n,e){var t=_r(e.value),i=_r(e.defaultValue);t!=null&&(t=""+t,t!==n.value&&(n.value=t),e.defaultValue==null&&n.defaultValue!==t&&(n.defaultValue=t)),i!=null&&(n.defaultValue=""+i)}function Mg(n){var e=n.textContent;e===n._wrapperState.initialValue&&e!==""&&e!==null&&(n.value=e)}function P0(n){switch(n){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function ad(n,e){return n==null||n==="http://www.w3.org/1999/xhtml"?P0(e):n==="http://www.w3.org/2000/svg"&&e==="foreignObject"?"http://www.w3.org/1999/xhtml":n}var Cl,I0=(function(n){return typeof MSApp<"u"&&MSApp.execUnsafeLocalFunction?function(e,t,i,r){MSApp.execUnsafeLocalFunction(function(){return n(e,t,i,r)})}:n})(function(n,e){if(n.namespaceURI!=="http://www.w3.org/2000/svg"||"innerHTML"in n)n.innerHTML=e;else{for(Cl=Cl||document.createElement("div"),Cl.innerHTML="<svg>"+e.valueOf().toString()+"</svg>",e=Cl.firstChild;n.firstChild;)n.removeChild(n.firstChild);for(;e.firstChild;)n.appendChild(e.firstChild)}});function _a(n,e){if(e){var t=n.firstChild;if(t&&t===n.lastChild&&t.nodeType===3){t.nodeValue=e;return}}n.textContent=e}var ca={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},NM=["Webkit","ms","Moz","O"];Object.keys(ca).forEach(function(n){NM.forEach(function(e){e=e+n.charAt(0).toUpperCase()+n.substring(1),ca[e]=ca[n]})});function L0(n,e,t){return e==null||typeof e=="boolean"||e===""?"":t||typeof e!="number"||e===0||ca.hasOwnProperty(n)&&ca[n]?(""+e).trim():e+"px"}function N0(n,e){n=n.style;for(var t in e)if(e.hasOwnProperty(t)){var i=t.indexOf("--")===0,r=L0(t,e[t],i);t==="float"&&(t="cssFloat"),i?n.setProperty(t,r):n[t]=r}}var DM=St({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function ld(n,e){if(e){if(DM[n]&&(e.children!=null||e.dangerouslySetInnerHTML!=null))throw Error(ie(137,n));if(e.dangerouslySetInnerHTML!=null){if(e.children!=null)throw Error(ie(60));if(typeof e.dangerouslySetInnerHTML!="object"||!("__html"in e.dangerouslySetInnerHTML))throw Error(ie(61))}if(e.style!=null&&typeof e.style!="object")throw Error(ie(62))}}function cd(n,e){if(n.indexOf("-")===-1)return typeof e.is=="string";switch(n){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var ud=null;function Zd(n){return n=n.target||n.srcElement||window,n.correspondingUseElement&&(n=n.correspondingUseElement),n.nodeType===3?n.parentNode:n}var hd=null,ks=null,zs=null;function Sg(n){if(n=Fa(n)){if(typeof hd!="function")throw Error(ie(280));var e=n.stateNode;e&&(e=Pc(e),hd(n.stateNode,n.type,e))}}function D0(n){ks?zs?zs.push(n):zs=[n]:ks=n}function U0(){if(ks){var n=ks,e=zs;if(zs=ks=null,Sg(n),e)for(n=0;n<e.length;n++)Sg(e[n])}}function O0(n,e){return n(e)}function F0(){}var Nh=!1;function k0(n,e,t){if(Nh)return n(e,t);Nh=!0;try{return O0(n,e,t)}finally{Nh=!1,(ks!==null||zs!==null)&&(F0(),U0())}}function xa(n,e){var t=n.stateNode;if(t===null)return null;var i=Pc(t);if(i===null)return null;t=i[e];e:switch(e){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(n=n.type,i=!(n==="button"||n==="input"||n==="select"||n==="textarea")),n=!i;break e;default:n=!1}if(n)return null;if(t&&typeof t!="function")throw Error(ie(231,e,typeof t));return t}var dd=!1;if(Di)try{ws={},Object.defineProperty(ws,"passive",{get:function(){dd=!0}}),window.addEventListener("test",ws,ws),window.removeEventListener("test",ws,ws)}catch{dd=!1}var ws;function UM(n,e,t,i,r,s,o,a,l){var c=Array.prototype.slice.call(arguments,3);try{e.apply(t,c)}catch(u){this.onError(u)}}var ua=!1,ic=null,rc=!1,fd=null,OM={onError:function(n){ua=!0,ic=n}};function FM(n,e,t,i,r,s,o,a,l){ua=!1,ic=null,UM.apply(OM,arguments)}function kM(n,e,t,i,r,s,o,a,l){if(FM.apply(this,arguments),ua){if(ua){var c=ic;ua=!1,ic=null}else throw Error(ie(198));rc||(rc=!0,fd=c)}}function rs(n){var e=n,t=n;if(n.alternate)for(;e.return;)e=e.return;else{n=e;do e=n,(e.flags&4098)!==0&&(t=e.return),n=e.return;while(n)}return e.tag===3?t:null}function z0(n){if(n.tag===13){var e=n.memoizedState;if(e===null&&(n=n.alternate,n!==null&&(e=n.memoizedState)),e!==null)return e.dehydrated}return null}function wg(n){if(rs(n)!==n)throw Error(ie(188))}function zM(n){var e=n.alternate;if(!e){if(e=rs(n),e===null)throw Error(ie(188));return e!==n?null:n}for(var t=n,i=e;;){var r=t.return;if(r===null)break;var s=r.alternate;if(s===null){if(i=r.return,i!==null){t=i;continue}break}if(r.child===s.child){for(s=r.child;s;){if(s===t)return wg(r),n;if(s===i)return wg(r),e;s=s.sibling}throw Error(ie(188))}if(t.return!==i.return)t=r,i=s;else{for(var o=!1,a=r.child;a;){if(a===t){o=!0,t=r,i=s;break}if(a===i){o=!0,i=r,t=s;break}a=a.sibling}if(!o){for(a=s.child;a;){if(a===t){o=!0,t=s,i=r;break}if(a===i){o=!0,i=s,t=r;break}a=a.sibling}if(!o)throw Error(ie(189))}}if(t.alternate!==i)throw Error(ie(190))}if(t.tag!==3)throw Error(ie(188));return t.stateNode.current===t?n:e}function B0(n){return n=zM(n),n!==null?V0(n):null}function V0(n){if(n.tag===5||n.tag===6)return n;for(n=n.child;n!==null;){var e=V0(n);if(e!==null)return e;n=n.sibling}return null}var H0=Nn.unstable_scheduleCallback,Eg=Nn.unstable_cancelCallback,BM=Nn.unstable_shouldYield,VM=Nn.unstable_requestPaint,Rt=Nn.unstable_now,HM=Nn.unstable_getCurrentPriorityLevel,$d=Nn.unstable_ImmediatePriority,G0=Nn.unstable_UserBlockingPriority,sc=Nn.unstable_NormalPriority,GM=Nn.unstable_LowPriority,W0=Nn.unstable_IdlePriority,Ac=null,yi=null;function WM(n){if(yi&&typeof yi.onCommitFiberRoot=="function")try{yi.onCommitFiberRoot(Ac,n,void 0,(n.current.flags&128)===128)}catch{}}var ri=Math.clz32?Math.clz32:YM,XM=Math.log,qM=Math.LN2;function YM(n){return n>>>=0,n===0?32:31-(XM(n)/qM|0)|0}var Pl=64,Il=4194304;function aa(n){switch(n&-n){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return n&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return n&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return n}}function oc(n,e){var t=n.pendingLanes;if(t===0)return 0;var i=0,r=n.suspendedLanes,s=n.pingedLanes,o=t&268435455;if(o!==0){var a=o&~r;a!==0?i=aa(a):(s&=o,s!==0&&(i=aa(s)))}else o=t&~r,o!==0?i=aa(o):s!==0&&(i=aa(s));if(i===0)return 0;if(e!==0&&e!==i&&(e&r)===0&&(r=i&-i,s=e&-e,r>=s||r===16&&(s&4194240)!==0))return e;if((i&4)!==0&&(i|=t&16),e=n.entangledLanes,e!==0)for(n=n.entanglements,e&=i;0<e;)t=31-ri(e),r=1<<t,i|=n[t],e&=~r;return i}function jM(n,e){switch(n){case 1:case 2:case 4:return e+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return e+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function KM(n,e){for(var t=n.suspendedLanes,i=n.pingedLanes,r=n.expirationTimes,s=n.pendingLanes;0<s;){var o=31-ri(s),a=1<<o,l=r[o];l===-1?((a&t)===0||(a&i)!==0)&&(r[o]=jM(a,e)):l<=e&&(n.expiredLanes|=a),s&=~a}}function pd(n){return n=n.pendingLanes&-1073741825,n!==0?n:n&1073741824?1073741824:0}function X0(){var n=Pl;return Pl<<=1,(Pl&4194240)===0&&(Pl=64),n}function Dh(n){for(var e=[],t=0;31>t;t++)e.push(n);return e}function Ua(n,e,t){n.pendingLanes|=e,e!==536870912&&(n.suspendedLanes=0,n.pingedLanes=0),n=n.eventTimes,e=31-ri(e),n[e]=t}function ZM(n,e){var t=n.pendingLanes&~e;n.pendingLanes=e,n.suspendedLanes=0,n.pingedLanes=0,n.expiredLanes&=e,n.mutableReadLanes&=e,n.entangledLanes&=e,e=n.entanglements;var i=n.eventTimes;for(n=n.expirationTimes;0<t;){var r=31-ri(t),s=1<<r;e[r]=0,i[r]=-1,n[r]=-1,t&=~s}}function Jd(n,e){var t=n.entangledLanes|=e;for(n=n.entanglements;t;){var i=31-ri(t),r=1<<i;r&e|n[i]&e&&(n[i]|=e),t&=~r}}var ot=0;function q0(n){return n&=-n,1<n?4<n?(n&268435455)!==0?16:536870912:4:1}var Y0,Qd,j0,K0,Z0,md=!1,Ll=[],hr=null,dr=null,fr=null,Ma=new Map,Sa=new Map,ar=[],$M="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function Tg(n,e){switch(n){case"focusin":case"focusout":hr=null;break;case"dragenter":case"dragleave":dr=null;break;case"mouseover":case"mouseout":fr=null;break;case"pointerover":case"pointerout":Ma.delete(e.pointerId);break;case"gotpointercapture":case"lostpointercapture":Sa.delete(e.pointerId)}}function Jo(n,e,t,i,r,s){return n===null||n.nativeEvent!==s?(n={blockedOn:e,domEventName:t,eventSystemFlags:i,nativeEvent:s,targetContainers:[r]},e!==null&&(e=Fa(e),e!==null&&Qd(e)),n):(n.eventSystemFlags|=i,e=n.targetContainers,r!==null&&e.indexOf(r)===-1&&e.push(r),n)}function JM(n,e,t,i,r){switch(e){case"focusin":return hr=Jo(hr,n,e,t,i,r),!0;case"dragenter":return dr=Jo(dr,n,e,t,i,r),!0;case"mouseover":return fr=Jo(fr,n,e,t,i,r),!0;case"pointerover":var s=r.pointerId;return Ma.set(s,Jo(Ma.get(s)||null,n,e,t,i,r)),!0;case"gotpointercapture":return s=r.pointerId,Sa.set(s,Jo(Sa.get(s)||null,n,e,t,i,r)),!0}return!1}function $0(n){var e=Yr(n.target);if(e!==null){var t=rs(e);if(t!==null){if(e=t.tag,e===13){if(e=z0(t),e!==null){n.blockedOn=e,Z0(n.priority,function(){j0(t)});return}}else if(e===3&&t.stateNode.current.memoizedState.isDehydrated){n.blockedOn=t.tag===3?t.stateNode.containerInfo:null;return}}}n.blockedOn=null}function ql(n){if(n.blockedOn!==null)return!1;for(var e=n.targetContainers;0<e.length;){var t=gd(n.domEventName,n.eventSystemFlags,e[0],n.nativeEvent);if(t===null){t=n.nativeEvent;var i=new t.constructor(t.type,t);ud=i,t.target.dispatchEvent(i),ud=null}else return e=Fa(t),e!==null&&Qd(e),n.blockedOn=t,!1;e.shift()}return!0}function Ag(n,e,t){ql(n)&&t.delete(e)}function QM(){md=!1,hr!==null&&ql(hr)&&(hr=null),dr!==null&&ql(dr)&&(dr=null),fr!==null&&ql(fr)&&(fr=null),Ma.forEach(Ag),Sa.forEach(Ag)}function Qo(n,e){n.blockedOn===e&&(n.blockedOn=null,md||(md=!0,Nn.unstable_scheduleCallback(Nn.unstable_NormalPriority,QM)))}function wa(n){function e(r){return Qo(r,n)}if(0<Ll.length){Qo(Ll[0],n);for(var t=1;t<Ll.length;t++){var i=Ll[t];i.blockedOn===n&&(i.blockedOn=null)}}for(hr!==null&&Qo(hr,n),dr!==null&&Qo(dr,n),fr!==null&&Qo(fr,n),Ma.forEach(e),Sa.forEach(e),t=0;t<ar.length;t++)i=ar[t],i.blockedOn===n&&(i.blockedOn=null);for(;0<ar.length&&(t=ar[0],t.blockedOn===null);)$0(t),t.blockedOn===null&&ar.shift()}var Bs=ki.ReactCurrentBatchConfig,ac=!0;function eS(n,e,t,i){var r=ot,s=Bs.transition;Bs.transition=null;try{ot=1,ef(n,e,t,i)}finally{ot=r,Bs.transition=s}}function tS(n,e,t,i){var r=ot,s=Bs.transition;Bs.transition=null;try{ot=4,ef(n,e,t,i)}finally{ot=r,Bs.transition=s}}function ef(n,e,t,i){if(ac){var r=gd(n,e,t,i);if(r===null)Vh(n,e,i,lc,t),Tg(n,i);else if(JM(r,n,e,t,i))i.stopPropagation();else if(Tg(n,i),e&4&&-1<$M.indexOf(n)){for(;r!==null;){var s=Fa(r);if(s!==null&&Y0(s),s=gd(n,e,t,i),s===null&&Vh(n,e,i,lc,t),s===r)break;r=s}r!==null&&i.stopPropagation()}else Vh(n,e,i,null,t)}}var lc=null;function gd(n,e,t,i){if(lc=null,n=Zd(i),n=Yr(n),n!==null)if(e=rs(n),e===null)n=null;else if(t=e.tag,t===13){if(n=z0(e),n!==null)return n;n=null}else if(t===3){if(e.stateNode.current.memoizedState.isDehydrated)return e.tag===3?e.stateNode.containerInfo:null;n=null}else e!==n&&(n=null);return lc=n,null}function J0(n){switch(n){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(HM()){case $d:return 1;case G0:return 4;case sc:case GM:return 16;case W0:return 536870912;default:return 16}default:return 16}}var cr=null,tf=null,Yl=null;function Q0(){if(Yl)return Yl;var n,e=tf,t=e.length,i,r="value"in cr?cr.value:cr.textContent,s=r.length;for(n=0;n<t&&e[n]===r[n];n++);var o=t-n;for(i=1;i<=o&&e[t-i]===r[s-i];i++);return Yl=r.slice(n,1<i?1-i:void 0)}function jl(n){var e=n.keyCode;return"charCode"in n?(n=n.charCode,n===0&&e===13&&(n=13)):n=e,n===10&&(n=13),32<=n||n===13?n:0}function Nl(){return!0}function bg(){return!1}function Dn(n){function e(t,i,r,s,o){this._reactName=t,this._targetInst=r,this.type=i,this.nativeEvent=s,this.target=o,this.currentTarget=null;for(var a in n)n.hasOwnProperty(a)&&(t=n[a],this[a]=t?t(s):s[a]);return this.isDefaultPrevented=(s.defaultPrevented!=null?s.defaultPrevented:s.returnValue===!1)?Nl:bg,this.isPropagationStopped=bg,this}return St(e.prototype,{preventDefault:function(){this.defaultPrevented=!0;var t=this.nativeEvent;t&&(t.preventDefault?t.preventDefault():typeof t.returnValue!="unknown"&&(t.returnValue=!1),this.isDefaultPrevented=Nl)},stopPropagation:function(){var t=this.nativeEvent;t&&(t.stopPropagation?t.stopPropagation():typeof t.cancelBubble!="unknown"&&(t.cancelBubble=!0),this.isPropagationStopped=Nl)},persist:function(){},isPersistent:Nl}),e}var Zs={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(n){return n.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},nf=Dn(Zs),Oa=St({},Zs,{view:0,detail:0}),nS=Dn(Oa),Uh,Oh,ea,bc=St({},Oa,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:rf,button:0,buttons:0,relatedTarget:function(n){return n.relatedTarget===void 0?n.fromElement===n.srcElement?n.toElement:n.fromElement:n.relatedTarget},movementX:function(n){return"movementX"in n?n.movementX:(n!==ea&&(ea&&n.type==="mousemove"?(Uh=n.screenX-ea.screenX,Oh=n.screenY-ea.screenY):Oh=Uh=0,ea=n),Uh)},movementY:function(n){return"movementY"in n?n.movementY:Oh}}),Rg=Dn(bc),iS=St({},bc,{dataTransfer:0}),rS=Dn(iS),sS=St({},Oa,{relatedTarget:0}),Fh=Dn(sS),oS=St({},Zs,{animationName:0,elapsedTime:0,pseudoElement:0}),aS=Dn(oS),lS=St({},Zs,{clipboardData:function(n){return"clipboardData"in n?n.clipboardData:window.clipboardData}}),cS=Dn(lS),uS=St({},Zs,{data:0}),Cg=Dn(uS),hS={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},dS={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},fS={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function pS(n){var e=this.nativeEvent;return e.getModifierState?e.getModifierState(n):(n=fS[n])?!!e[n]:!1}function rf(){return pS}var mS=St({},Oa,{key:function(n){if(n.key){var e=hS[n.key]||n.key;if(e!=="Unidentified")return e}return n.type==="keypress"?(n=jl(n),n===13?"Enter":String.fromCharCode(n)):n.type==="keydown"||n.type==="keyup"?dS[n.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:rf,charCode:function(n){return n.type==="keypress"?jl(n):0},keyCode:function(n){return n.type==="keydown"||n.type==="keyup"?n.keyCode:0},which:function(n){return n.type==="keypress"?jl(n):n.type==="keydown"||n.type==="keyup"?n.keyCode:0}}),gS=Dn(mS),vS=St({},bc,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Pg=Dn(vS),yS=St({},Oa,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:rf}),_S=Dn(yS),xS=St({},Zs,{propertyName:0,elapsedTime:0,pseudoElement:0}),MS=Dn(xS),SS=St({},bc,{deltaX:function(n){return"deltaX"in n?n.deltaX:"wheelDeltaX"in n?-n.wheelDeltaX:0},deltaY:function(n){return"deltaY"in n?n.deltaY:"wheelDeltaY"in n?-n.wheelDeltaY:"wheelDelta"in n?-n.wheelDelta:0},deltaZ:0,deltaMode:0}),wS=Dn(SS),ES=[9,13,27,32],sf=Di&&"CompositionEvent"in window,ha=null;Di&&"documentMode"in document&&(ha=document.documentMode);var TS=Di&&"TextEvent"in window&&!ha,ev=Di&&(!sf||ha&&8<ha&&11>=ha),Ig=" ",Lg=!1;function tv(n,e){switch(n){case"keyup":return ES.indexOf(e.keyCode)!==-1;case"keydown":return e.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function nv(n){return n=n.detail,typeof n=="object"&&"data"in n?n.data:null}var bs=!1;function AS(n,e){switch(n){case"compositionend":return nv(e);case"keypress":return e.which!==32?null:(Lg=!0,Ig);case"textInput":return n=e.data,n===Ig&&Lg?null:n;default:return null}}function bS(n,e){if(bs)return n==="compositionend"||!sf&&tv(n,e)?(n=Q0(),Yl=tf=cr=null,bs=!1,n):null;switch(n){case"paste":return null;case"keypress":if(!(e.ctrlKey||e.altKey||e.metaKey)||e.ctrlKey&&e.altKey){if(e.char&&1<e.char.length)return e.char;if(e.which)return String.fromCharCode(e.which)}return null;case"compositionend":return ev&&e.locale!=="ko"?null:e.data;default:return null}}var RS={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Ng(n){var e=n&&n.nodeName&&n.nodeName.toLowerCase();return e==="input"?!!RS[n.type]:e==="textarea"}function iv(n,e,t,i){D0(i),e=cc(e,"onChange"),0<e.length&&(t=new nf("onChange","change",null,t,i),n.push({event:t,listeners:e}))}var da=null,Ea=null;function CS(n){pv(n,0)}function Rc(n){var e=Ps(n);if(b0(e))return n}function PS(n,e){if(n==="change")return e}var rv=!1;Di&&(Di?(Ul="oninput"in document,Ul||(kh=document.createElement("div"),kh.setAttribute("oninput","return;"),Ul=typeof kh.oninput=="function"),Dl=Ul):Dl=!1,rv=Dl&&(!document.documentMode||9<document.documentMode));var Dl,Ul,kh;function Dg(){da&&(da.detachEvent("onpropertychange",sv),Ea=da=null)}function sv(n){if(n.propertyName==="value"&&Rc(Ea)){var e=[];iv(e,Ea,n,Zd(n)),k0(CS,e)}}function IS(n,e,t){n==="focusin"?(Dg(),da=e,Ea=t,da.attachEvent("onpropertychange",sv)):n==="focusout"&&Dg()}function LS(n){if(n==="selectionchange"||n==="keyup"||n==="keydown")return Rc(Ea)}function NS(n,e){if(n==="click")return Rc(e)}function DS(n,e){if(n==="input"||n==="change")return Rc(e)}function US(n,e){return n===e&&(n!==0||1/n===1/e)||n!==n&&e!==e}var oi=typeof Object.is=="function"?Object.is:US;function Ta(n,e){if(oi(n,e))return!0;if(typeof n!="object"||n===null||typeof e!="object"||e===null)return!1;var t=Object.keys(n),i=Object.keys(e);if(t.length!==i.length)return!1;for(i=0;i<t.length;i++){var r=t[i];if(!Jh.call(e,r)||!oi(n[r],e[r]))return!1}return!0}function Ug(n){for(;n&&n.firstChild;)n=n.firstChild;return n}function Og(n,e){var t=Ug(n);n=0;for(var i;t;){if(t.nodeType===3){if(i=n+t.textContent.length,n<=e&&i>=e)return{node:t,offset:e-n};n=i}e:{for(;t;){if(t.nextSibling){t=t.nextSibling;break e}t=t.parentNode}t=void 0}t=Ug(t)}}function ov(n,e){return n&&e?n===e?!0:n&&n.nodeType===3?!1:e&&e.nodeType===3?ov(n,e.parentNode):"contains"in n?n.contains(e):n.compareDocumentPosition?!!(n.compareDocumentPosition(e)&16):!1:!1}function av(){for(var n=window,e=nc();e instanceof n.HTMLIFrameElement;){try{var t=typeof e.contentWindow.location.href=="string"}catch{t=!1}if(t)n=e.contentWindow;else break;e=nc(n.document)}return e}function of(n){var e=n&&n.nodeName&&n.nodeName.toLowerCase();return e&&(e==="input"&&(n.type==="text"||n.type==="search"||n.type==="tel"||n.type==="url"||n.type==="password")||e==="textarea"||n.contentEditable==="true")}function OS(n){var e=av(),t=n.focusedElem,i=n.selectionRange;if(e!==t&&t&&t.ownerDocument&&ov(t.ownerDocument.documentElement,t)){if(i!==null&&of(t)){if(e=i.start,n=i.end,n===void 0&&(n=e),"selectionStart"in t)t.selectionStart=e,t.selectionEnd=Math.min(n,t.value.length);else if(n=(e=t.ownerDocument||document)&&e.defaultView||window,n.getSelection){n=n.getSelection();var r=t.textContent.length,s=Math.min(i.start,r);i=i.end===void 0?s:Math.min(i.end,r),!n.extend&&s>i&&(r=i,i=s,s=r),r=Og(t,s);var o=Og(t,i);r&&o&&(n.rangeCount!==1||n.anchorNode!==r.node||n.anchorOffset!==r.offset||n.focusNode!==o.node||n.focusOffset!==o.offset)&&(e=e.createRange(),e.setStart(r.node,r.offset),n.removeAllRanges(),s>i?(n.addRange(e),n.extend(o.node,o.offset)):(e.setEnd(o.node,o.offset),n.addRange(e)))}}for(e=[],n=t;n=n.parentNode;)n.nodeType===1&&e.push({element:n,left:n.scrollLeft,top:n.scrollTop});for(typeof t.focus=="function"&&t.focus(),t=0;t<e.length;t++)n=e[t],n.element.scrollLeft=n.left,n.element.scrollTop=n.top}}var FS=Di&&"documentMode"in document&&11>=document.documentMode,Rs=null,vd=null,fa=null,yd=!1;function Fg(n,e,t){var i=t.window===t?t.document:t.nodeType===9?t:t.ownerDocument;yd||Rs==null||Rs!==nc(i)||(i=Rs,"selectionStart"in i&&of(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),fa&&Ta(fa,i)||(fa=i,i=cc(vd,"onSelect"),0<i.length&&(e=new nf("onSelect","select",null,e,t),n.push({event:e,listeners:i}),e.target=Rs)))}function Ol(n,e){var t={};return t[n.toLowerCase()]=e.toLowerCase(),t["Webkit"+n]="webkit"+e,t["Moz"+n]="moz"+e,t}var Cs={animationend:Ol("Animation","AnimationEnd"),animationiteration:Ol("Animation","AnimationIteration"),animationstart:Ol("Animation","AnimationStart"),transitionend:Ol("Transition","TransitionEnd")},zh={},lv={};Di&&(lv=document.createElement("div").style,"AnimationEvent"in window||(delete Cs.animationend.animation,delete Cs.animationiteration.animation,delete Cs.animationstart.animation),"TransitionEvent"in window||delete Cs.transitionend.transition);function Cc(n){if(zh[n])return zh[n];if(!Cs[n])return n;var e=Cs[n],t;for(t in e)if(e.hasOwnProperty(t)&&t in lv)return zh[n]=e[t];return n}var cv=Cc("animationend"),uv=Cc("animationiteration"),hv=Cc("animationstart"),dv=Cc("transitionend"),fv=new Map,kg="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function Mr(n,e){fv.set(n,e),is(e,[n])}for(Fl=0;Fl<kg.length;Fl++)kl=kg[Fl],zg=kl.toLowerCase(),Bg=kl[0].toUpperCase()+kl.slice(1),Mr(zg,"on"+Bg);var kl,zg,Bg,Fl;Mr(cv,"onAnimationEnd");Mr(uv,"onAnimationIteration");Mr(hv,"onAnimationStart");Mr("dblclick","onDoubleClick");Mr("focusin","onFocus");Mr("focusout","onBlur");Mr(dv,"onTransitionEnd");Gs("onMouseEnter",["mouseout","mouseover"]);Gs("onMouseLeave",["mouseout","mouseover"]);Gs("onPointerEnter",["pointerout","pointerover"]);Gs("onPointerLeave",["pointerout","pointerover"]);is("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));is("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));is("onBeforeInput",["compositionend","keypress","textInput","paste"]);is("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));is("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));is("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var la="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),kS=new Set("cancel close invalid load scroll toggle".split(" ").concat(la));function Vg(n,e,t){var i=n.type||"unknown-event";n.currentTarget=t,kM(i,e,void 0,n),n.currentTarget=null}function pv(n,e){e=(e&4)!==0;for(var t=0;t<n.length;t++){var i=n[t],r=i.event;i=i.listeners;e:{var s=void 0;if(e)for(var o=i.length-1;0<=o;o--){var a=i[o],l=a.instance,c=a.currentTarget;if(a=a.listener,l!==s&&r.isPropagationStopped())break e;Vg(r,a,c),s=l}else for(o=0;o<i.length;o++){if(a=i[o],l=a.instance,c=a.currentTarget,a=a.listener,l!==s&&r.isPropagationStopped())break e;Vg(r,a,c),s=l}}}if(rc)throw n=fd,rc=!1,fd=null,n}function ft(n,e){var t=e[wd];t===void 0&&(t=e[wd]=new Set);var i=n+"__bubble";t.has(i)||(mv(e,n,2,!1),t.add(i))}function Bh(n,e,t){var i=0;e&&(i|=4),mv(t,n,i,e)}var zl="_reactListening"+Math.random().toString(36).slice(2);function Aa(n){if(!n[zl]){n[zl]=!0,S0.forEach(function(t){t!=="selectionchange"&&(kS.has(t)||Bh(t,!1,n),Bh(t,!0,n))});var e=n.nodeType===9?n:n.ownerDocument;e===null||e[zl]||(e[zl]=!0,Bh("selectionchange",!1,e))}}function mv(n,e,t,i){switch(J0(e)){case 1:var r=eS;break;case 4:r=tS;break;default:r=ef}t=r.bind(null,e,t,n),r=void 0,!dd||e!=="touchstart"&&e!=="touchmove"&&e!=="wheel"||(r=!0),i?r!==void 0?n.addEventListener(e,t,{capture:!0,passive:r}):n.addEventListener(e,t,!0):r!==void 0?n.addEventListener(e,t,{passive:r}):n.addEventListener(e,t,!1)}function Vh(n,e,t,i,r){var s=i;if((e&1)===0&&(e&2)===0&&i!==null)e:for(;;){if(i===null)return;var o=i.tag;if(o===3||o===4){var a=i.stateNode.containerInfo;if(a===r||a.nodeType===8&&a.parentNode===r)break;if(o===4)for(o=i.return;o!==null;){var l=o.tag;if((l===3||l===4)&&(l=o.stateNode.containerInfo,l===r||l.nodeType===8&&l.parentNode===r))return;o=o.return}for(;a!==null;){if(o=Yr(a),o===null)return;if(l=o.tag,l===5||l===6){i=s=o;continue e}a=a.parentNode}}i=i.return}k0(function(){var c=s,u=Zd(t),h=[];e:{var d=fv.get(n);if(d!==void 0){var p=nf,v=n;switch(n){case"keypress":if(jl(t)===0)break e;case"keydown":case"keyup":p=gS;break;case"focusin":v="focus",p=Fh;break;case"focusout":v="blur",p=Fh;break;case"beforeblur":case"afterblur":p=Fh;break;case"click":if(t.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":p=Rg;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":p=rS;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":p=_S;break;case cv:case uv:case hv:p=aS;break;case dv:p=MS;break;case"scroll":p=nS;break;case"wheel":p=wS;break;case"copy":case"cut":case"paste":p=cS;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":p=Pg}var _=(e&4)!==0,m=!_&&n==="scroll",f=_?d!==null?d+"Capture":null:d;_=[];for(var g=c,y;g!==null;){y=g;var x=y.stateNode;if(y.tag===5&&x!==null&&(y=x,f!==null&&(x=xa(g,f),x!=null&&_.push(ba(g,x,y)))),m)break;g=g.return}0<_.length&&(d=new p(d,v,null,t,u),h.push({event:d,listeners:_}))}}if((e&7)===0){e:{if(d=n==="mouseover"||n==="pointerover",p=n==="mouseout"||n==="pointerout",d&&t!==ud&&(v=t.relatedTarget||t.fromElement)&&(Yr(v)||v[Ui]))break e;if((p||d)&&(d=u.window===u?u:(d=u.ownerDocument)?d.defaultView||d.parentWindow:window,p?(v=t.relatedTarget||t.toElement,p=c,v=v?Yr(v):null,v!==null&&(m=rs(v),v!==m||v.tag!==5&&v.tag!==6)&&(v=null)):(p=null,v=c),p!==v)){if(_=Rg,x="onMouseLeave",f="onMouseEnter",g="mouse",(n==="pointerout"||n==="pointerover")&&(_=Pg,x="onPointerLeave",f="onPointerEnter",g="pointer"),m=p==null?d:Ps(p),y=v==null?d:Ps(v),d=new _(x,g+"leave",p,t,u),d.target=m,d.relatedTarget=y,x=null,Yr(u)===c&&(_=new _(f,g+"enter",v,t,u),_.target=y,_.relatedTarget=m,x=_),m=x,p&&v)t:{for(_=p,f=v,g=0,y=_;y;y=Es(y))g++;for(y=0,x=f;x;x=Es(x))y++;for(;0<g-y;)_=Es(_),g--;for(;0<y-g;)f=Es(f),y--;for(;g--;){if(_===f||f!==null&&_===f.alternate)break t;_=Es(_),f=Es(f)}_=null}else _=null;p!==null&&Hg(h,d,p,_,!1),v!==null&&m!==null&&Hg(h,m,v,_,!0)}}e:{if(d=c?Ps(c):window,p=d.nodeName&&d.nodeName.toLowerCase(),p==="select"||p==="input"&&d.type==="file")var R=PS;else if(Ng(d))if(rv)R=DS;else{R=LS;var T=IS}else(p=d.nodeName)&&p.toLowerCase()==="input"&&(d.type==="checkbox"||d.type==="radio")&&(R=NS);if(R&&(R=R(n,c))){iv(h,R,t,u);break e}T&&T(n,d,c),n==="focusout"&&(T=d._wrapperState)&&T.controlled&&d.type==="number"&&sd(d,"number",d.value)}switch(T=c?Ps(c):window,n){case"focusin":(Ng(T)||T.contentEditable==="true")&&(Rs=T,vd=c,fa=null);break;case"focusout":fa=vd=Rs=null;break;case"mousedown":yd=!0;break;case"contextmenu":case"mouseup":case"dragend":yd=!1,Fg(h,t,u);break;case"selectionchange":if(FS)break;case"keydown":case"keyup":Fg(h,t,u)}var b;if(sf)e:{switch(n){case"compositionstart":var C="onCompositionStart";break e;case"compositionend":C="onCompositionEnd";break e;case"compositionupdate":C="onCompositionUpdate";break e}C=void 0}else bs?tv(n,t)&&(C="onCompositionEnd"):n==="keydown"&&t.keyCode===229&&(C="onCompositionStart");C&&(ev&&t.locale!=="ko"&&(bs||C!=="onCompositionStart"?C==="onCompositionEnd"&&bs&&(b=Q0()):(cr=u,tf="value"in cr?cr.value:cr.textContent,bs=!0)),T=cc(c,C),0<T.length&&(C=new Cg(C,n,null,t,u),h.push({event:C,listeners:T}),b?C.data=b:(b=nv(t),b!==null&&(C.data=b)))),(b=TS?AS(n,t):bS(n,t))&&(c=cc(c,"onBeforeInput"),0<c.length&&(u=new Cg("onBeforeInput","beforeinput",null,t,u),h.push({event:u,listeners:c}),u.data=b))}pv(h,e)})}function ba(n,e,t){return{instance:n,listener:e,currentTarget:t}}function cc(n,e){for(var t=e+"Capture",i=[];n!==null;){var r=n,s=r.stateNode;r.tag===5&&s!==null&&(r=s,s=xa(n,t),s!=null&&i.unshift(ba(n,s,r)),s=xa(n,e),s!=null&&i.push(ba(n,s,r))),n=n.return}return i}function Es(n){if(n===null)return null;do n=n.return;while(n&&n.tag!==5);return n||null}function Hg(n,e,t,i,r){for(var s=e._reactName,o=[];t!==null&&t!==i;){var a=t,l=a.alternate,c=a.stateNode;if(l!==null&&l===i)break;a.tag===5&&c!==null&&(a=c,r?(l=xa(t,s),l!=null&&o.unshift(ba(t,l,a))):r||(l=xa(t,s),l!=null&&o.push(ba(t,l,a)))),t=t.return}o.length!==0&&n.push({event:e,listeners:o})}var zS=/\r\n?/g,BS=/\u0000|\uFFFD/g;function Gg(n){return(typeof n=="string"?n:""+n).replace(zS,`
`).replace(BS,"")}function Bl(n,e,t){if(e=Gg(e),Gg(n)!==e&&t)throw Error(ie(425))}function uc(){}var _d=null,xd=null;function Md(n,e){return n==="textarea"||n==="noscript"||typeof e.children=="string"||typeof e.children=="number"||typeof e.dangerouslySetInnerHTML=="object"&&e.dangerouslySetInnerHTML!==null&&e.dangerouslySetInnerHTML.__html!=null}var Sd=typeof setTimeout=="function"?setTimeout:void 0,VS=typeof clearTimeout=="function"?clearTimeout:void 0,Wg=typeof Promise=="function"?Promise:void 0,HS=typeof queueMicrotask=="function"?queueMicrotask:typeof Wg<"u"?function(n){return Wg.resolve(null).then(n).catch(GS)}:Sd;function GS(n){setTimeout(function(){throw n})}function Hh(n,e){var t=e,i=0;do{var r=t.nextSibling;if(n.removeChild(t),r&&r.nodeType===8)if(t=r.data,t==="/$"){if(i===0){n.removeChild(r),wa(e);return}i--}else t!=="$"&&t!=="$?"&&t!=="$!"||i++;t=r}while(t);wa(e)}function pr(n){for(;n!=null;n=n.nextSibling){var e=n.nodeType;if(e===1||e===3)break;if(e===8){if(e=n.data,e==="$"||e==="$!"||e==="$?")break;if(e==="/$")return null}}return n}function Xg(n){n=n.previousSibling;for(var e=0;n;){if(n.nodeType===8){var t=n.data;if(t==="$"||t==="$!"||t==="$?"){if(e===0)return n;e--}else t==="/$"&&e++}n=n.previousSibling}return null}var $s=Math.random().toString(36).slice(2),vi="__reactFiber$"+$s,Ra="__reactProps$"+$s,Ui="__reactContainer$"+$s,wd="__reactEvents$"+$s,WS="__reactListeners$"+$s,XS="__reactHandles$"+$s;function Yr(n){var e=n[vi];if(e)return e;for(var t=n.parentNode;t;){if(e=t[Ui]||t[vi]){if(t=e.alternate,e.child!==null||t!==null&&t.child!==null)for(n=Xg(n);n!==null;){if(t=n[vi])return t;n=Xg(n)}return e}n=t,t=n.parentNode}return null}function Fa(n){return n=n[vi]||n[Ui],!n||n.tag!==5&&n.tag!==6&&n.tag!==13&&n.tag!==3?null:n}function Ps(n){if(n.tag===5||n.tag===6)return n.stateNode;throw Error(ie(33))}function Pc(n){return n[Ra]||null}var Ed=[],Is=-1;function Sr(n){return{current:n}}function pt(n){0>Is||(n.current=Ed[Is],Ed[Is]=null,Is--)}function dt(n,e){Is++,Ed[Is]=n.current,n.current=e}var xr={},sn=Sr(xr),wn=Sr(!1),Jr=xr;function Ws(n,e){var t=n.type.contextTypes;if(!t)return xr;var i=n.stateNode;if(i&&i.__reactInternalMemoizedUnmaskedChildContext===e)return i.__reactInternalMemoizedMaskedChildContext;var r={},s;for(s in t)r[s]=e[s];return i&&(n=n.stateNode,n.__reactInternalMemoizedUnmaskedChildContext=e,n.__reactInternalMemoizedMaskedChildContext=r),r}function En(n){return n=n.childContextTypes,n!=null}function hc(){pt(wn),pt(sn)}function qg(n,e,t){if(sn.current!==xr)throw Error(ie(168));dt(sn,e),dt(wn,t)}function gv(n,e,t){var i=n.stateNode;if(e=e.childContextTypes,typeof i.getChildContext!="function")return t;i=i.getChildContext();for(var r in i)if(!(r in e))throw Error(ie(108,IM(n)||"Unknown",r));return St({},t,i)}function dc(n){return n=(n=n.stateNode)&&n.__reactInternalMemoizedMergedChildContext||xr,Jr=sn.current,dt(sn,n),dt(wn,wn.current),!0}function Yg(n,e,t){var i=n.stateNode;if(!i)throw Error(ie(169));t?(n=gv(n,e,Jr),i.__reactInternalMemoizedMergedChildContext=n,pt(wn),pt(sn),dt(sn,n)):pt(wn),dt(wn,t)}var Pi=null,Ic=!1,Gh=!1;function vv(n){Pi===null?Pi=[n]:Pi.push(n)}function qS(n){Ic=!0,vv(n)}function wr(){if(!Gh&&Pi!==null){Gh=!0;var n=0,e=ot;try{var t=Pi;for(ot=1;n<t.length;n++){var i=t[n];do i=i(!0);while(i!==null)}Pi=null,Ic=!1}catch(r){throw Pi!==null&&(Pi=Pi.slice(n+1)),H0($d,wr),r}finally{ot=e,Gh=!1}}return null}var Ls=[],Ns=0,fc=null,pc=0,Gn=[],Wn=0,Qr=null,Ii=1,Li="";function Xr(n,e){Ls[Ns++]=pc,Ls[Ns++]=fc,fc=n,pc=e}function yv(n,e,t){Gn[Wn++]=Ii,Gn[Wn++]=Li,Gn[Wn++]=Qr,Qr=n;var i=Ii;n=Li;var r=32-ri(i)-1;i&=~(1<<r),t+=1;var s=32-ri(e)+r;if(30<s){var o=r-r%5;s=(i&(1<<o)-1).toString(32),i>>=o,r-=o,Ii=1<<32-ri(e)+r|t<<r|i,Li=s+n}else Ii=1<<s|t<<r|i,Li=n}function af(n){n.return!==null&&(Xr(n,1),yv(n,1,0))}function lf(n){for(;n===fc;)fc=Ls[--Ns],Ls[Ns]=null,pc=Ls[--Ns],Ls[Ns]=null;for(;n===Qr;)Qr=Gn[--Wn],Gn[Wn]=null,Li=Gn[--Wn],Gn[Wn]=null,Ii=Gn[--Wn],Gn[Wn]=null}var Ln=null,In=null,_t=!1,ii=null;function _v(n,e){var t=Xn(5,null,null,0);t.elementType="DELETED",t.stateNode=e,t.return=n,e=n.deletions,e===null?(n.deletions=[t],n.flags|=16):e.push(t)}function jg(n,e){switch(n.tag){case 5:var t=n.type;return e=e.nodeType!==1||t.toLowerCase()!==e.nodeName.toLowerCase()?null:e,e!==null?(n.stateNode=e,Ln=n,In=pr(e.firstChild),!0):!1;case 6:return e=n.pendingProps===""||e.nodeType!==3?null:e,e!==null?(n.stateNode=e,Ln=n,In=null,!0):!1;case 13:return e=e.nodeType!==8?null:e,e!==null?(t=Qr!==null?{id:Ii,overflow:Li}:null,n.memoizedState={dehydrated:e,treeContext:t,retryLane:1073741824},t=Xn(18,null,null,0),t.stateNode=e,t.return=n,n.child=t,Ln=n,In=null,!0):!1;default:return!1}}function Td(n){return(n.mode&1)!==0&&(n.flags&128)===0}function Ad(n){if(_t){var e=In;if(e){var t=e;if(!jg(n,e)){if(Td(n))throw Error(ie(418));e=pr(t.nextSibling);var i=Ln;e&&jg(n,e)?_v(i,t):(n.flags=n.flags&-4097|2,_t=!1,Ln=n)}}else{if(Td(n))throw Error(ie(418));n.flags=n.flags&-4097|2,_t=!1,Ln=n}}}function Kg(n){for(n=n.return;n!==null&&n.tag!==5&&n.tag!==3&&n.tag!==13;)n=n.return;Ln=n}function Vl(n){if(n!==Ln)return!1;if(!_t)return Kg(n),_t=!0,!1;var e;if((e=n.tag!==3)&&!(e=n.tag!==5)&&(e=n.type,e=e!=="head"&&e!=="body"&&!Md(n.type,n.memoizedProps)),e&&(e=In)){if(Td(n))throw xv(),Error(ie(418));for(;e;)_v(n,e),e=pr(e.nextSibling)}if(Kg(n),n.tag===13){if(n=n.memoizedState,n=n!==null?n.dehydrated:null,!n)throw Error(ie(317));e:{for(n=n.nextSibling,e=0;n;){if(n.nodeType===8){var t=n.data;if(t==="/$"){if(e===0){In=pr(n.nextSibling);break e}e--}else t!=="$"&&t!=="$!"&&t!=="$?"||e++}n=n.nextSibling}In=null}}else In=Ln?pr(n.stateNode.nextSibling):null;return!0}function xv(){for(var n=In;n;)n=pr(n.nextSibling)}function Xs(){In=Ln=null,_t=!1}function cf(n){ii===null?ii=[n]:ii.push(n)}var YS=ki.ReactCurrentBatchConfig;function ti(n,e){if(n&&n.defaultProps){e=St({},e),n=n.defaultProps;for(var t in n)e[t]===void 0&&(e[t]=n[t]);return e}return e}var mc=Sr(null),gc=null,Ds=null,uf=null;function hf(){uf=Ds=gc=null}function df(n){var e=mc.current;pt(mc),n._currentValue=e}function bd(n,e,t){for(;n!==null;){var i=n.alternate;if((n.childLanes&e)!==e?(n.childLanes|=e,i!==null&&(i.childLanes|=e)):i!==null&&(i.childLanes&e)!==e&&(i.childLanes|=e),n===t)break;n=n.return}}function Vs(n,e){gc=n,uf=Ds=null,n=n.dependencies,n!==null&&n.firstContext!==null&&((n.lanes&e)!==0&&(Sn=!0),n.firstContext=null)}function Yn(n){var e=n._currentValue;if(uf!==n)if(n={context:n,memoizedValue:e,next:null},Ds===null){if(gc===null)throw Error(ie(308));Ds=n,gc.dependencies={lanes:0,firstContext:n}}else Ds=Ds.next=n;return e}var jr=null;function ff(n){jr===null?jr=[n]:jr.push(n)}function Mv(n,e,t,i){var r=e.interleaved;return r===null?(t.next=t,ff(e)):(t.next=r.next,r.next=t),e.interleaved=t,Oi(n,i)}function Oi(n,e){n.lanes|=e;var t=n.alternate;for(t!==null&&(t.lanes|=e),t=n,n=n.return;n!==null;)n.childLanes|=e,t=n.alternate,t!==null&&(t.childLanes|=e),t=n,n=n.return;return t.tag===3?t.stateNode:null}var or=!1;function pf(n){n.updateQueue={baseState:n.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function Sv(n,e){n=n.updateQueue,e.updateQueue===n&&(e.updateQueue={baseState:n.baseState,firstBaseUpdate:n.firstBaseUpdate,lastBaseUpdate:n.lastBaseUpdate,shared:n.shared,effects:n.effects})}function Ni(n,e){return{eventTime:n,lane:e,tag:0,payload:null,callback:null,next:null}}function mr(n,e,t){var i=n.updateQueue;if(i===null)return null;if(i=i.shared,(et&2)!==0){var r=i.pending;return r===null?e.next=e:(e.next=r.next,r.next=e),i.pending=e,Oi(n,t)}return r=i.interleaved,r===null?(e.next=e,ff(i)):(e.next=r.next,r.next=e),i.interleaved=e,Oi(n,t)}function Kl(n,e,t){if(e=e.updateQueue,e!==null&&(e=e.shared,(t&4194240)!==0)){var i=e.lanes;i&=n.pendingLanes,t|=i,e.lanes=t,Jd(n,t)}}function Zg(n,e){var t=n.updateQueue,i=n.alternate;if(i!==null&&(i=i.updateQueue,t===i)){var r=null,s=null;if(t=t.firstBaseUpdate,t!==null){do{var o={eventTime:t.eventTime,lane:t.lane,tag:t.tag,payload:t.payload,callback:t.callback,next:null};s===null?r=s=o:s=s.next=o,t=t.next}while(t!==null);s===null?r=s=e:s=s.next=e}else r=s=e;t={baseState:i.baseState,firstBaseUpdate:r,lastBaseUpdate:s,shared:i.shared,effects:i.effects},n.updateQueue=t;return}n=t.lastBaseUpdate,n===null?t.firstBaseUpdate=e:n.next=e,t.lastBaseUpdate=e}function vc(n,e,t,i){var r=n.updateQueue;or=!1;var s=r.firstBaseUpdate,o=r.lastBaseUpdate,a=r.shared.pending;if(a!==null){r.shared.pending=null;var l=a,c=l.next;l.next=null,o===null?s=c:o.next=c,o=l;var u=n.alternate;u!==null&&(u=u.updateQueue,a=u.lastBaseUpdate,a!==o&&(a===null?u.firstBaseUpdate=c:a.next=c,u.lastBaseUpdate=l))}if(s!==null){var h=r.baseState;o=0,u=c=l=null,a=s;do{var d=a.lane,p=a.eventTime;if((i&d)===d){u!==null&&(u=u.next={eventTime:p,lane:0,tag:a.tag,payload:a.payload,callback:a.callback,next:null});e:{var v=n,_=a;switch(d=e,p=t,_.tag){case 1:if(v=_.payload,typeof v=="function"){h=v.call(p,h,d);break e}h=v;break e;case 3:v.flags=v.flags&-65537|128;case 0:if(v=_.payload,d=typeof v=="function"?v.call(p,h,d):v,d==null)break e;h=St({},h,d);break e;case 2:or=!0}}a.callback!==null&&a.lane!==0&&(n.flags|=64,d=r.effects,d===null?r.effects=[a]:d.push(a))}else p={eventTime:p,lane:d,tag:a.tag,payload:a.payload,callback:a.callback,next:null},u===null?(c=u=p,l=h):u=u.next=p,o|=d;if(a=a.next,a===null){if(a=r.shared.pending,a===null)break;d=a,a=d.next,d.next=null,r.lastBaseUpdate=d,r.shared.pending=null}}while(!0);if(u===null&&(l=h),r.baseState=l,r.firstBaseUpdate=c,r.lastBaseUpdate=u,e=r.shared.interleaved,e!==null){r=e;do o|=r.lane,r=r.next;while(r!==e)}else s===null&&(r.shared.lanes=0);ts|=o,n.lanes=o,n.memoizedState=h}}function $g(n,e,t){if(n=e.effects,e.effects=null,n!==null)for(e=0;e<n.length;e++){var i=n[e],r=i.callback;if(r!==null){if(i.callback=null,i=t,typeof r!="function")throw Error(ie(191,r));r.call(i)}}}var wv=new M0.Component().refs;function Rd(n,e,t,i){e=n.memoizedState,t=t(i,e),t=t==null?e:St({},e,t),n.memoizedState=t,n.lanes===0&&(n.updateQueue.baseState=t)}var Lc={isMounted:function(n){return(n=n._reactInternals)?rs(n)===n:!1},enqueueSetState:function(n,e,t){n=n._reactInternals;var i=pn(),r=vr(n),s=Ni(i,r);s.payload=e,t!=null&&(s.callback=t),e=mr(n,s,r),e!==null&&(si(e,n,r,i),Kl(e,n,r))},enqueueReplaceState:function(n,e,t){n=n._reactInternals;var i=pn(),r=vr(n),s=Ni(i,r);s.tag=1,s.payload=e,t!=null&&(s.callback=t),e=mr(n,s,r),e!==null&&(si(e,n,r,i),Kl(e,n,r))},enqueueForceUpdate:function(n,e){n=n._reactInternals;var t=pn(),i=vr(n),r=Ni(t,i);r.tag=2,e!=null&&(r.callback=e),e=mr(n,r,i),e!==null&&(si(e,n,i,t),Kl(e,n,i))}};function Jg(n,e,t,i,r,s,o){return n=n.stateNode,typeof n.shouldComponentUpdate=="function"?n.shouldComponentUpdate(i,s,o):e.prototype&&e.prototype.isPureReactComponent?!Ta(t,i)||!Ta(r,s):!0}function Ev(n,e,t){var i=!1,r=xr,s=e.contextType;return typeof s=="object"&&s!==null?s=Yn(s):(r=En(e)?Jr:sn.current,i=e.contextTypes,s=(i=i!=null)?Ws(n,r):xr),e=new e(t,s),n.memoizedState=e.state!==null&&e.state!==void 0?e.state:null,e.updater=Lc,n.stateNode=e,e._reactInternals=n,i&&(n=n.stateNode,n.__reactInternalMemoizedUnmaskedChildContext=r,n.__reactInternalMemoizedMaskedChildContext=s),e}function Qg(n,e,t,i){n=e.state,typeof e.componentWillReceiveProps=="function"&&e.componentWillReceiveProps(t,i),typeof e.UNSAFE_componentWillReceiveProps=="function"&&e.UNSAFE_componentWillReceiveProps(t,i),e.state!==n&&Lc.enqueueReplaceState(e,e.state,null)}function Cd(n,e,t,i){var r=n.stateNode;r.props=t,r.state=n.memoizedState,r.refs=wv,pf(n);var s=e.contextType;typeof s=="object"&&s!==null?r.context=Yn(s):(s=En(e)?Jr:sn.current,r.context=Ws(n,s)),r.state=n.memoizedState,s=e.getDerivedStateFromProps,typeof s=="function"&&(Rd(n,e,s,t),r.state=n.memoizedState),typeof e.getDerivedStateFromProps=="function"||typeof r.getSnapshotBeforeUpdate=="function"||typeof r.UNSAFE_componentWillMount!="function"&&typeof r.componentWillMount!="function"||(e=r.state,typeof r.componentWillMount=="function"&&r.componentWillMount(),typeof r.UNSAFE_componentWillMount=="function"&&r.UNSAFE_componentWillMount(),e!==r.state&&Lc.enqueueReplaceState(r,r.state,null),vc(n,t,r,i),r.state=n.memoizedState),typeof r.componentDidMount=="function"&&(n.flags|=4194308)}function ta(n,e,t){if(n=t.ref,n!==null&&typeof n!="function"&&typeof n!="object"){if(t._owner){if(t=t._owner,t){if(t.tag!==1)throw Error(ie(309));var i=t.stateNode}if(!i)throw Error(ie(147,n));var r=i,s=""+n;return e!==null&&e.ref!==null&&typeof e.ref=="function"&&e.ref._stringRef===s?e.ref:(e=function(o){var a=r.refs;a===wv&&(a=r.refs={}),o===null?delete a[s]:a[s]=o},e._stringRef=s,e)}if(typeof n!="string")throw Error(ie(284));if(!t._owner)throw Error(ie(290,n))}return n}function Hl(n,e){throw n=Object.prototype.toString.call(e),Error(ie(31,n==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":n))}function e0(n){var e=n._init;return e(n._payload)}function Tv(n){function e(f,g){if(n){var y=f.deletions;y===null?(f.deletions=[g],f.flags|=16):y.push(g)}}function t(f,g){if(!n)return null;for(;g!==null;)e(f,g),g=g.sibling;return null}function i(f,g){for(f=new Map;g!==null;)g.key!==null?f.set(g.key,g):f.set(g.index,g),g=g.sibling;return f}function r(f,g){return f=yr(f,g),f.index=0,f.sibling=null,f}function s(f,g,y){return f.index=y,n?(y=f.alternate,y!==null?(y=y.index,y<g?(f.flags|=2,g):y):(f.flags|=2,g)):(f.flags|=1048576,g)}function o(f){return n&&f.alternate===null&&(f.flags|=2),f}function a(f,g,y,x){return g===null||g.tag!==6?(g=Zh(y,f.mode,x),g.return=f,g):(g=r(g,y),g.return=f,g)}function l(f,g,y,x){var R=y.type;return R===As?u(f,g,y.props.children,x,y.key):g!==null&&(g.elementType===R||typeof R=="object"&&R!==null&&R.$$typeof===sr&&e0(R)===g.type)?(x=r(g,y.props),x.ref=ta(f,g,y),x.return=f,x):(x=tc(y.type,y.key,y.props,null,f.mode,x),x.ref=ta(f,g,y),x.return=f,x)}function c(f,g,y,x){return g===null||g.tag!==4||g.stateNode.containerInfo!==y.containerInfo||g.stateNode.implementation!==y.implementation?(g=$h(y,f.mode,x),g.return=f,g):(g=r(g,y.children||[]),g.return=f,g)}function u(f,g,y,x,R){return g===null||g.tag!==7?(g=$r(y,f.mode,x,R),g.return=f,g):(g=r(g,y),g.return=f,g)}function h(f,g,y){if(typeof g=="string"&&g!==""||typeof g=="number")return g=Zh(""+g,f.mode,y),g.return=f,g;if(typeof g=="object"&&g!==null){switch(g.$$typeof){case bl:return y=tc(g.type,g.key,g.props,null,f.mode,y),y.ref=ta(f,null,g),y.return=f,y;case Ts:return g=$h(g,f.mode,y),g.return=f,g;case sr:var x=g._init;return h(f,x(g._payload),y)}if(oa(g)||$o(g))return g=$r(g,f.mode,y,null),g.return=f,g;Hl(f,g)}return null}function d(f,g,y,x){var R=g!==null?g.key:null;if(typeof y=="string"&&y!==""||typeof y=="number")return R!==null?null:a(f,g,""+y,x);if(typeof y=="object"&&y!==null){switch(y.$$typeof){case bl:return y.key===R?l(f,g,y,x):null;case Ts:return y.key===R?c(f,g,y,x):null;case sr:return R=y._init,d(f,g,R(y._payload),x)}if(oa(y)||$o(y))return R!==null?null:u(f,g,y,x,null);Hl(f,y)}return null}function p(f,g,y,x,R){if(typeof x=="string"&&x!==""||typeof x=="number")return f=f.get(y)||null,a(g,f,""+x,R);if(typeof x=="object"&&x!==null){switch(x.$$typeof){case bl:return f=f.get(x.key===null?y:x.key)||null,l(g,f,x,R);case Ts:return f=f.get(x.key===null?y:x.key)||null,c(g,f,x,R);case sr:var T=x._init;return p(f,g,y,T(x._payload),R)}if(oa(x)||$o(x))return f=f.get(y)||null,u(g,f,x,R,null);Hl(g,x)}return null}function v(f,g,y,x){for(var R=null,T=null,b=g,C=g=0,E=null;b!==null&&C<y.length;C++){b.index>C?(E=b,b=null):E=b.sibling;var M=d(f,b,y[C],x);if(M===null){b===null&&(b=E);break}n&&b&&M.alternate===null&&e(f,b),g=s(M,g,C),T===null?R=M:T.sibling=M,T=M,b=E}if(C===y.length)return t(f,b),_t&&Xr(f,C),R;if(b===null){for(;C<y.length;C++)b=h(f,y[C],x),b!==null&&(g=s(b,g,C),T===null?R=b:T.sibling=b,T=b);return _t&&Xr(f,C),R}for(b=i(f,b);C<y.length;C++)E=p(b,f,C,y[C],x),E!==null&&(n&&E.alternate!==null&&b.delete(E.key===null?C:E.key),g=s(E,g,C),T===null?R=E:T.sibling=E,T=E);return n&&b.forEach(function(L){return e(f,L)}),_t&&Xr(f,C),R}function _(f,g,y,x){var R=$o(y);if(typeof R!="function")throw Error(ie(150));if(y=R.call(y),y==null)throw Error(ie(151));for(var T=R=null,b=g,C=g=0,E=null,M=y.next();b!==null&&!M.done;C++,M=y.next()){b.index>C?(E=b,b=null):E=b.sibling;var L=d(f,b,M.value,x);if(L===null){b===null&&(b=E);break}n&&b&&L.alternate===null&&e(f,b),g=s(L,g,C),T===null?R=L:T.sibling=L,T=L,b=E}if(M.done)return t(f,b),_t&&Xr(f,C),R;if(b===null){for(;!M.done;C++,M=y.next())M=h(f,M.value,x),M!==null&&(g=s(M,g,C),T===null?R=M:T.sibling=M,T=M);return _t&&Xr(f,C),R}for(b=i(f,b);!M.done;C++,M=y.next())M=p(b,f,C,M.value,x),M!==null&&(n&&M.alternate!==null&&b.delete(M.key===null?C:M.key),g=s(M,g,C),T===null?R=M:T.sibling=M,T=M);return n&&b.forEach(function(U){return e(f,U)}),_t&&Xr(f,C),R}function m(f,g,y,x){if(typeof y=="object"&&y!==null&&y.type===As&&y.key===null&&(y=y.props.children),typeof y=="object"&&y!==null){switch(y.$$typeof){case bl:e:{for(var R=y.key,T=g;T!==null;){if(T.key===R){if(R=y.type,R===As){if(T.tag===7){t(f,T.sibling),g=r(T,y.props.children),g.return=f,f=g;break e}}else if(T.elementType===R||typeof R=="object"&&R!==null&&R.$$typeof===sr&&e0(R)===T.type){t(f,T.sibling),g=r(T,y.props),g.ref=ta(f,T,y),g.return=f,f=g;break e}t(f,T);break}else e(f,T);T=T.sibling}y.type===As?(g=$r(y.props.children,f.mode,x,y.key),g.return=f,f=g):(x=tc(y.type,y.key,y.props,null,f.mode,x),x.ref=ta(f,g,y),x.return=f,f=x)}return o(f);case Ts:e:{for(T=y.key;g!==null;){if(g.key===T)if(g.tag===4&&g.stateNode.containerInfo===y.containerInfo&&g.stateNode.implementation===y.implementation){t(f,g.sibling),g=r(g,y.children||[]),g.return=f,f=g;break e}else{t(f,g);break}else e(f,g);g=g.sibling}g=$h(y,f.mode,x),g.return=f,f=g}return o(f);case sr:return T=y._init,m(f,g,T(y._payload),x)}if(oa(y))return v(f,g,y,x);if($o(y))return _(f,g,y,x);Hl(f,y)}return typeof y=="string"&&y!==""||typeof y=="number"?(y=""+y,g!==null&&g.tag===6?(t(f,g.sibling),g=r(g,y),g.return=f,f=g):(t(f,g),g=Zh(y,f.mode,x),g.return=f,f=g),o(f)):t(f,g)}return m}var qs=Tv(!0),Av=Tv(!1),ka={},_i=Sr(ka),Ca=Sr(ka),Pa=Sr(ka);function Kr(n){if(n===ka)throw Error(ie(174));return n}function mf(n,e){switch(dt(Pa,e),dt(Ca,n),dt(_i,ka),n=e.nodeType,n){case 9:case 11:e=(e=e.documentElement)?e.namespaceURI:ad(null,"");break;default:n=n===8?e.parentNode:e,e=n.namespaceURI||null,n=n.tagName,e=ad(e,n)}pt(_i),dt(_i,e)}function Ys(){pt(_i),pt(Ca),pt(Pa)}function bv(n){Kr(Pa.current);var e=Kr(_i.current),t=ad(e,n.type);e!==t&&(dt(Ca,n),dt(_i,t))}function gf(n){Ca.current===n&&(pt(_i),pt(Ca))}var xt=Sr(0);function yc(n){for(var e=n;e!==null;){if(e.tag===13){var t=e.memoizedState;if(t!==null&&(t=t.dehydrated,t===null||t.data==="$?"||t.data==="$!"))return e}else if(e.tag===19&&e.memoizedProps.revealOrder!==void 0){if((e.flags&128)!==0)return e}else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===n)break;for(;e.sibling===null;){if(e.return===null||e.return===n)return null;e=e.return}e.sibling.return=e.return,e=e.sibling}return null}var Wh=[];function vf(){for(var n=0;n<Wh.length;n++)Wh[n]._workInProgressVersionPrimary=null;Wh.length=0}var Zl=ki.ReactCurrentDispatcher,Xh=ki.ReactCurrentBatchConfig,es=0,Mt=null,Ut=null,Ht=null,_c=!1,pa=!1,Ia=0,jS=0;function tn(){throw Error(ie(321))}function yf(n,e){if(e===null)return!1;for(var t=0;t<e.length&&t<n.length;t++)if(!oi(n[t],e[t]))return!1;return!0}function _f(n,e,t,i,r,s){if(es=s,Mt=e,e.memoizedState=null,e.updateQueue=null,e.lanes=0,Zl.current=n===null||n.memoizedState===null?JS:QS,n=t(i,r),pa){s=0;do{if(pa=!1,Ia=0,25<=s)throw Error(ie(301));s+=1,Ht=Ut=null,e.updateQueue=null,Zl.current=e1,n=t(i,r)}while(pa)}if(Zl.current=xc,e=Ut!==null&&Ut.next!==null,es=0,Ht=Ut=Mt=null,_c=!1,e)throw Error(ie(300));return n}function xf(){var n=Ia!==0;return Ia=0,n}function gi(){var n={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return Ht===null?Mt.memoizedState=Ht=n:Ht=Ht.next=n,Ht}function jn(){if(Ut===null){var n=Mt.alternate;n=n!==null?n.memoizedState:null}else n=Ut.next;var e=Ht===null?Mt.memoizedState:Ht.next;if(e!==null)Ht=e,Ut=n;else{if(n===null)throw Error(ie(310));Ut=n,n={memoizedState:Ut.memoizedState,baseState:Ut.baseState,baseQueue:Ut.baseQueue,queue:Ut.queue,next:null},Ht===null?Mt.memoizedState=Ht=n:Ht=Ht.next=n}return Ht}function La(n,e){return typeof e=="function"?e(n):e}function qh(n){var e=jn(),t=e.queue;if(t===null)throw Error(ie(311));t.lastRenderedReducer=n;var i=Ut,r=i.baseQueue,s=t.pending;if(s!==null){if(r!==null){var o=r.next;r.next=s.next,s.next=o}i.baseQueue=r=s,t.pending=null}if(r!==null){s=r.next,i=i.baseState;var a=o=null,l=null,c=s;do{var u=c.lane;if((es&u)===u)l!==null&&(l=l.next={lane:0,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),i=c.hasEagerState?c.eagerState:n(i,c.action);else{var h={lane:u,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null};l===null?(a=l=h,o=i):l=l.next=h,Mt.lanes|=u,ts|=u}c=c.next}while(c!==null&&c!==s);l===null?o=i:l.next=a,oi(i,e.memoizedState)||(Sn=!0),e.memoizedState=i,e.baseState=o,e.baseQueue=l,t.lastRenderedState=i}if(n=t.interleaved,n!==null){r=n;do s=r.lane,Mt.lanes|=s,ts|=s,r=r.next;while(r!==n)}else r===null&&(t.lanes=0);return[e.memoizedState,t.dispatch]}function Yh(n){var e=jn(),t=e.queue;if(t===null)throw Error(ie(311));t.lastRenderedReducer=n;var i=t.dispatch,r=t.pending,s=e.memoizedState;if(r!==null){t.pending=null;var o=r=r.next;do s=n(s,o.action),o=o.next;while(o!==r);oi(s,e.memoizedState)||(Sn=!0),e.memoizedState=s,e.baseQueue===null&&(e.baseState=s),t.lastRenderedState=s}return[s,i]}function Rv(){}function Cv(n,e){var t=Mt,i=jn(),r=e(),s=!oi(i.memoizedState,r);if(s&&(i.memoizedState=r,Sn=!0),i=i.queue,Mf(Lv.bind(null,t,i,n),[n]),i.getSnapshot!==e||s||Ht!==null&&Ht.memoizedState.tag&1){if(t.flags|=2048,Na(9,Iv.bind(null,t,i,r,e),void 0,null),Gt===null)throw Error(ie(349));(es&30)!==0||Pv(t,e,r)}return r}function Pv(n,e,t){n.flags|=16384,n={getSnapshot:e,value:t},e=Mt.updateQueue,e===null?(e={lastEffect:null,stores:null},Mt.updateQueue=e,e.stores=[n]):(t=e.stores,t===null?e.stores=[n]:t.push(n))}function Iv(n,e,t,i){e.value=t,e.getSnapshot=i,Nv(e)&&Dv(n)}function Lv(n,e,t){return t(function(){Nv(e)&&Dv(n)})}function Nv(n){var e=n.getSnapshot;n=n.value;try{var t=e();return!oi(n,t)}catch{return!0}}function Dv(n){var e=Oi(n,1);e!==null&&si(e,n,1,-1)}function t0(n){var e=gi();return typeof n=="function"&&(n=n()),e.memoizedState=e.baseState=n,n={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:La,lastRenderedState:n},e.queue=n,n=n.dispatch=$S.bind(null,Mt,n),[e.memoizedState,n]}function Na(n,e,t,i){return n={tag:n,create:e,destroy:t,deps:i,next:null},e=Mt.updateQueue,e===null?(e={lastEffect:null,stores:null},Mt.updateQueue=e,e.lastEffect=n.next=n):(t=e.lastEffect,t===null?e.lastEffect=n.next=n:(i=t.next,t.next=n,n.next=i,e.lastEffect=n)),n}function Uv(){return jn().memoizedState}function $l(n,e,t,i){var r=gi();Mt.flags|=n,r.memoizedState=Na(1|e,t,void 0,i===void 0?null:i)}function Nc(n,e,t,i){var r=jn();i=i===void 0?null:i;var s=void 0;if(Ut!==null){var o=Ut.memoizedState;if(s=o.destroy,i!==null&&yf(i,o.deps)){r.memoizedState=Na(e,t,s,i);return}}Mt.flags|=n,r.memoizedState=Na(1|e,t,s,i)}function n0(n,e){return $l(8390656,8,n,e)}function Mf(n,e){return Nc(2048,8,n,e)}function Ov(n,e){return Nc(4,2,n,e)}function Fv(n,e){return Nc(4,4,n,e)}function kv(n,e){if(typeof e=="function")return n=n(),e(n),function(){e(null)};if(e!=null)return n=n(),e.current=n,function(){e.current=null}}function zv(n,e,t){return t=t!=null?t.concat([n]):null,Nc(4,4,kv.bind(null,e,n),t)}function Sf(){}function Bv(n,e){var t=jn();e=e===void 0?null:e;var i=t.memoizedState;return i!==null&&e!==null&&yf(e,i[1])?i[0]:(t.memoizedState=[n,e],n)}function Vv(n,e){var t=jn();e=e===void 0?null:e;var i=t.memoizedState;return i!==null&&e!==null&&yf(e,i[1])?i[0]:(n=n(),t.memoizedState=[n,e],n)}function Hv(n,e,t){return(es&21)===0?(n.baseState&&(n.baseState=!1,Sn=!0),n.memoizedState=t):(oi(t,e)||(t=X0(),Mt.lanes|=t,ts|=t,n.baseState=!0),e)}function KS(n,e){var t=ot;ot=t!==0&&4>t?t:4,n(!0);var i=Xh.transition;Xh.transition={};try{n(!1),e()}finally{ot=t,Xh.transition=i}}function Gv(){return jn().memoizedState}function ZS(n,e,t){var i=vr(n);if(t={lane:i,action:t,hasEagerState:!1,eagerState:null,next:null},Wv(n))Xv(e,t);else if(t=Mv(n,e,t,i),t!==null){var r=pn();si(t,n,i,r),qv(t,e,i)}}function $S(n,e,t){var i=vr(n),r={lane:i,action:t,hasEagerState:!1,eagerState:null,next:null};if(Wv(n))Xv(e,r);else{var s=n.alternate;if(n.lanes===0&&(s===null||s.lanes===0)&&(s=e.lastRenderedReducer,s!==null))try{var o=e.lastRenderedState,a=s(o,t);if(r.hasEagerState=!0,r.eagerState=a,oi(a,o)){var l=e.interleaved;l===null?(r.next=r,ff(e)):(r.next=l.next,l.next=r),e.interleaved=r;return}}catch{}t=Mv(n,e,r,i),t!==null&&(r=pn(),si(t,n,i,r),qv(t,e,i))}}function Wv(n){var e=n.alternate;return n===Mt||e!==null&&e===Mt}function Xv(n,e){pa=_c=!0;var t=n.pending;t===null?e.next=e:(e.next=t.next,t.next=e),n.pending=e}function qv(n,e,t){if((t&4194240)!==0){var i=e.lanes;i&=n.pendingLanes,t|=i,e.lanes=t,Jd(n,t)}}var xc={readContext:Yn,useCallback:tn,useContext:tn,useEffect:tn,useImperativeHandle:tn,useInsertionEffect:tn,useLayoutEffect:tn,useMemo:tn,useReducer:tn,useRef:tn,useState:tn,useDebugValue:tn,useDeferredValue:tn,useTransition:tn,useMutableSource:tn,useSyncExternalStore:tn,useId:tn,unstable_isNewReconciler:!1},JS={readContext:Yn,useCallback:function(n,e){return gi().memoizedState=[n,e===void 0?null:e],n},useContext:Yn,useEffect:n0,useImperativeHandle:function(n,e,t){return t=t!=null?t.concat([n]):null,$l(4194308,4,kv.bind(null,e,n),t)},useLayoutEffect:function(n,e){return $l(4194308,4,n,e)},useInsertionEffect:function(n,e){return $l(4,2,n,e)},useMemo:function(n,e){var t=gi();return e=e===void 0?null:e,n=n(),t.memoizedState=[n,e],n},useReducer:function(n,e,t){var i=gi();return e=t!==void 0?t(e):e,i.memoizedState=i.baseState=e,n={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:n,lastRenderedState:e},i.queue=n,n=n.dispatch=ZS.bind(null,Mt,n),[i.memoizedState,n]},useRef:function(n){var e=gi();return n={current:n},e.memoizedState=n},useState:t0,useDebugValue:Sf,useDeferredValue:function(n){return gi().memoizedState=n},useTransition:function(){var n=t0(!1),e=n[0];return n=KS.bind(null,n[1]),gi().memoizedState=n,[e,n]},useMutableSource:function(){},useSyncExternalStore:function(n,e,t){var i=Mt,r=gi();if(_t){if(t===void 0)throw Error(ie(407));t=t()}else{if(t=e(),Gt===null)throw Error(ie(349));(es&30)!==0||Pv(i,e,t)}r.memoizedState=t;var s={value:t,getSnapshot:e};return r.queue=s,n0(Lv.bind(null,i,s,n),[n]),i.flags|=2048,Na(9,Iv.bind(null,i,s,t,e),void 0,null),t},useId:function(){var n=gi(),e=Gt.identifierPrefix;if(_t){var t=Li,i=Ii;t=(i&~(1<<32-ri(i)-1)).toString(32)+t,e=":"+e+"R"+t,t=Ia++,0<t&&(e+="H"+t.toString(32)),e+=":"}else t=jS++,e=":"+e+"r"+t.toString(32)+":";return n.memoizedState=e},unstable_isNewReconciler:!1},QS={readContext:Yn,useCallback:Bv,useContext:Yn,useEffect:Mf,useImperativeHandle:zv,useInsertionEffect:Ov,useLayoutEffect:Fv,useMemo:Vv,useReducer:qh,useRef:Uv,useState:function(){return qh(La)},useDebugValue:Sf,useDeferredValue:function(n){var e=jn();return Hv(e,Ut.memoizedState,n)},useTransition:function(){var n=qh(La)[0],e=jn().memoizedState;return[n,e]},useMutableSource:Rv,useSyncExternalStore:Cv,useId:Gv,unstable_isNewReconciler:!1},e1={readContext:Yn,useCallback:Bv,useContext:Yn,useEffect:Mf,useImperativeHandle:zv,useInsertionEffect:Ov,useLayoutEffect:Fv,useMemo:Vv,useReducer:Yh,useRef:Uv,useState:function(){return Yh(La)},useDebugValue:Sf,useDeferredValue:function(n){var e=jn();return Ut===null?e.memoizedState=n:Hv(e,Ut.memoizedState,n)},useTransition:function(){var n=Yh(La)[0],e=jn().memoizedState;return[n,e]},useMutableSource:Rv,useSyncExternalStore:Cv,useId:Gv,unstable_isNewReconciler:!1};function js(n,e){try{var t="",i=e;do t+=PM(i),i=i.return;while(i);var r=t}catch(s){r=`
Error generating stack: `+s.message+`
`+s.stack}return{value:n,source:e,stack:r,digest:null}}function jh(n,e,t){return{value:n,source:null,stack:t??null,digest:e??null}}function Pd(n,e){try{console.error(e.value)}catch(t){setTimeout(function(){throw t})}}var t1=typeof WeakMap=="function"?WeakMap:Map;function Yv(n,e,t){t=Ni(-1,t),t.tag=3,t.payload={element:null};var i=e.value;return t.callback=function(){Sc||(Sc=!0,Bd=i),Pd(n,e)},t}function jv(n,e,t){t=Ni(-1,t),t.tag=3;var i=n.type.getDerivedStateFromError;if(typeof i=="function"){var r=e.value;t.payload=function(){return i(r)},t.callback=function(){Pd(n,e)}}var s=n.stateNode;return s!==null&&typeof s.componentDidCatch=="function"&&(t.callback=function(){Pd(n,e),typeof i!="function"&&(gr===null?gr=new Set([this]):gr.add(this));var o=e.stack;this.componentDidCatch(e.value,{componentStack:o!==null?o:""})}),t}function i0(n,e,t){var i=n.pingCache;if(i===null){i=n.pingCache=new t1;var r=new Set;i.set(e,r)}else r=i.get(e),r===void 0&&(r=new Set,i.set(e,r));r.has(t)||(r.add(t),n=m1.bind(null,n,e,t),e.then(n,n))}function r0(n){do{var e;if((e=n.tag===13)&&(e=n.memoizedState,e=e!==null?e.dehydrated!==null:!0),e)return n;n=n.return}while(n!==null);return null}function s0(n,e,t,i,r){return(n.mode&1)===0?(n===e?n.flags|=65536:(n.flags|=128,t.flags|=131072,t.flags&=-52805,t.tag===1&&(t.alternate===null?t.tag=17:(e=Ni(-1,1),e.tag=2,mr(t,e,1))),t.lanes|=1),n):(n.flags|=65536,n.lanes=r,n)}var n1=ki.ReactCurrentOwner,Sn=!1;function fn(n,e,t,i){e.child=n===null?Av(e,null,t,i):qs(e,n.child,t,i)}function o0(n,e,t,i,r){t=t.render;var s=e.ref;return Vs(e,r),i=_f(n,e,t,i,s,r),t=xf(),n!==null&&!Sn?(e.updateQueue=n.updateQueue,e.flags&=-2053,n.lanes&=~r,Fi(n,e,r)):(_t&&t&&af(e),e.flags|=1,fn(n,e,i,r),e.child)}function a0(n,e,t,i,r){if(n===null){var s=t.type;return typeof s=="function"&&!Pf(s)&&s.defaultProps===void 0&&t.compare===null&&t.defaultProps===void 0?(e.tag=15,e.type=s,Kv(n,e,s,i,r)):(n=tc(t.type,null,i,e,e.mode,r),n.ref=e.ref,n.return=e,e.child=n)}if(s=n.child,(n.lanes&r)===0){var o=s.memoizedProps;if(t=t.compare,t=t!==null?t:Ta,t(o,i)&&n.ref===e.ref)return Fi(n,e,r)}return e.flags|=1,n=yr(s,i),n.ref=e.ref,n.return=e,e.child=n}function Kv(n,e,t,i,r){if(n!==null){var s=n.memoizedProps;if(Ta(s,i)&&n.ref===e.ref)if(Sn=!1,e.pendingProps=i=s,(n.lanes&r)!==0)(n.flags&131072)!==0&&(Sn=!0);else return e.lanes=n.lanes,Fi(n,e,r)}return Id(n,e,t,i,r)}function Zv(n,e,t){var i=e.pendingProps,r=i.children,s=n!==null?n.memoizedState:null;if(i.mode==="hidden")if((e.mode&1)===0)e.memoizedState={baseLanes:0,cachePool:null,transitions:null},dt(Os,Pn),Pn|=t;else{if((t&1073741824)===0)return n=s!==null?s.baseLanes|t:t,e.lanes=e.childLanes=1073741824,e.memoizedState={baseLanes:n,cachePool:null,transitions:null},e.updateQueue=null,dt(Os,Pn),Pn|=n,null;e.memoizedState={baseLanes:0,cachePool:null,transitions:null},i=s!==null?s.baseLanes:t,dt(Os,Pn),Pn|=i}else s!==null?(i=s.baseLanes|t,e.memoizedState=null):i=t,dt(Os,Pn),Pn|=i;return fn(n,e,r,t),e.child}function $v(n,e){var t=e.ref;(n===null&&t!==null||n!==null&&n.ref!==t)&&(e.flags|=512,e.flags|=2097152)}function Id(n,e,t,i,r){var s=En(t)?Jr:sn.current;return s=Ws(e,s),Vs(e,r),t=_f(n,e,t,i,s,r),i=xf(),n!==null&&!Sn?(e.updateQueue=n.updateQueue,e.flags&=-2053,n.lanes&=~r,Fi(n,e,r)):(_t&&i&&af(e),e.flags|=1,fn(n,e,t,r),e.child)}function l0(n,e,t,i,r){if(En(t)){var s=!0;dc(e)}else s=!1;if(Vs(e,r),e.stateNode===null)Jl(n,e),Ev(e,t,i),Cd(e,t,i,r),i=!0;else if(n===null){var o=e.stateNode,a=e.memoizedProps;o.props=a;var l=o.context,c=t.contextType;typeof c=="object"&&c!==null?c=Yn(c):(c=En(t)?Jr:sn.current,c=Ws(e,c));var u=t.getDerivedStateFromProps,h=typeof u=="function"||typeof o.getSnapshotBeforeUpdate=="function";h||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(a!==i||l!==c)&&Qg(e,o,i,c),or=!1;var d=e.memoizedState;o.state=d,vc(e,i,o,r),l=e.memoizedState,a!==i||d!==l||wn.current||or?(typeof u=="function"&&(Rd(e,t,u,i),l=e.memoizedState),(a=or||Jg(e,t,a,i,d,l,c))?(h||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount()),typeof o.componentDidMount=="function"&&(e.flags|=4194308)):(typeof o.componentDidMount=="function"&&(e.flags|=4194308),e.memoizedProps=i,e.memoizedState=l),o.props=i,o.state=l,o.context=c,i=a):(typeof o.componentDidMount=="function"&&(e.flags|=4194308),i=!1)}else{o=e.stateNode,Sv(n,e),a=e.memoizedProps,c=e.type===e.elementType?a:ti(e.type,a),o.props=c,h=e.pendingProps,d=o.context,l=t.contextType,typeof l=="object"&&l!==null?l=Yn(l):(l=En(t)?Jr:sn.current,l=Ws(e,l));var p=t.getDerivedStateFromProps;(u=typeof p=="function"||typeof o.getSnapshotBeforeUpdate=="function")||typeof o.UNSAFE_componentWillReceiveProps!="function"&&typeof o.componentWillReceiveProps!="function"||(a!==h||d!==l)&&Qg(e,o,i,l),or=!1,d=e.memoizedState,o.state=d,vc(e,i,o,r);var v=e.memoizedState;a!==h||d!==v||wn.current||or?(typeof p=="function"&&(Rd(e,t,p,i),v=e.memoizedState),(c=or||Jg(e,t,c,i,d,v,l)||!1)?(u||typeof o.UNSAFE_componentWillUpdate!="function"&&typeof o.componentWillUpdate!="function"||(typeof o.componentWillUpdate=="function"&&o.componentWillUpdate(i,v,l),typeof o.UNSAFE_componentWillUpdate=="function"&&o.UNSAFE_componentWillUpdate(i,v,l)),typeof o.componentDidUpdate=="function"&&(e.flags|=4),typeof o.getSnapshotBeforeUpdate=="function"&&(e.flags|=1024)):(typeof o.componentDidUpdate!="function"||a===n.memoizedProps&&d===n.memoizedState||(e.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||a===n.memoizedProps&&d===n.memoizedState||(e.flags|=1024),e.memoizedProps=i,e.memoizedState=v),o.props=i,o.state=v,o.context=l,i=c):(typeof o.componentDidUpdate!="function"||a===n.memoizedProps&&d===n.memoizedState||(e.flags|=4),typeof o.getSnapshotBeforeUpdate!="function"||a===n.memoizedProps&&d===n.memoizedState||(e.flags|=1024),i=!1)}return Ld(n,e,t,i,s,r)}function Ld(n,e,t,i,r,s){$v(n,e);var o=(e.flags&128)!==0;if(!i&&!o)return r&&Yg(e,t,!1),Fi(n,e,s);i=e.stateNode,n1.current=e;var a=o&&typeof t.getDerivedStateFromError!="function"?null:i.render();return e.flags|=1,n!==null&&o?(e.child=qs(e,n.child,null,s),e.child=qs(e,null,a,s)):fn(n,e,a,s),e.memoizedState=i.state,r&&Yg(e,t,!0),e.child}function Jv(n){var e=n.stateNode;e.pendingContext?qg(n,e.pendingContext,e.pendingContext!==e.context):e.context&&qg(n,e.context,!1),mf(n,e.containerInfo)}function c0(n,e,t,i,r){return Xs(),cf(r),e.flags|=256,fn(n,e,t,i),e.child}var Nd={dehydrated:null,treeContext:null,retryLane:0};function Dd(n){return{baseLanes:n,cachePool:null,transitions:null}}function Qv(n,e,t){var i=e.pendingProps,r=xt.current,s=!1,o=(e.flags&128)!==0,a;if((a=o)||(a=n!==null&&n.memoizedState===null?!1:(r&2)!==0),a?(s=!0,e.flags&=-129):(n===null||n.memoizedState!==null)&&(r|=1),dt(xt,r&1),n===null)return Ad(e),n=e.memoizedState,n!==null&&(n=n.dehydrated,n!==null)?((e.mode&1)===0?e.lanes=1:n.data==="$!"?e.lanes=8:e.lanes=1073741824,null):(o=i.children,n=i.fallback,s?(i=e.mode,s=e.child,o={mode:"hidden",children:o},(i&1)===0&&s!==null?(s.childLanes=0,s.pendingProps=o):s=Oc(o,i,0,null),n=$r(n,i,t,null),s.return=e,n.return=e,s.sibling=n,e.child=s,e.child.memoizedState=Dd(t),e.memoizedState=Nd,n):wf(e,o));if(r=n.memoizedState,r!==null&&(a=r.dehydrated,a!==null))return i1(n,e,o,i,a,r,t);if(s){s=i.fallback,o=e.mode,r=n.child,a=r.sibling;var l={mode:"hidden",children:i.children};return(o&1)===0&&e.child!==r?(i=e.child,i.childLanes=0,i.pendingProps=l,e.deletions=null):(i=yr(r,l),i.subtreeFlags=r.subtreeFlags&14680064),a!==null?s=yr(a,s):(s=$r(s,o,t,null),s.flags|=2),s.return=e,i.return=e,i.sibling=s,e.child=i,i=s,s=e.child,o=n.child.memoizedState,o=o===null?Dd(t):{baseLanes:o.baseLanes|t,cachePool:null,transitions:o.transitions},s.memoizedState=o,s.childLanes=n.childLanes&~t,e.memoizedState=Nd,i}return s=n.child,n=s.sibling,i=yr(s,{mode:"visible",children:i.children}),(e.mode&1)===0&&(i.lanes=t),i.return=e,i.sibling=null,n!==null&&(t=e.deletions,t===null?(e.deletions=[n],e.flags|=16):t.push(n)),e.child=i,e.memoizedState=null,i}function wf(n,e){return e=Oc({mode:"visible",children:e},n.mode,0,null),e.return=n,n.child=e}function Gl(n,e,t,i){return i!==null&&cf(i),qs(e,n.child,null,t),n=wf(e,e.pendingProps.children),n.flags|=2,e.memoizedState=null,n}function i1(n,e,t,i,r,s,o){if(t)return e.flags&256?(e.flags&=-257,i=jh(Error(ie(422))),Gl(n,e,o,i)):e.memoizedState!==null?(e.child=n.child,e.flags|=128,null):(s=i.fallback,r=e.mode,i=Oc({mode:"visible",children:i.children},r,0,null),s=$r(s,r,o,null),s.flags|=2,i.return=e,s.return=e,i.sibling=s,e.child=i,(e.mode&1)!==0&&qs(e,n.child,null,o),e.child.memoizedState=Dd(o),e.memoizedState=Nd,s);if((e.mode&1)===0)return Gl(n,e,o,null);if(r.data==="$!"){if(i=r.nextSibling&&r.nextSibling.dataset,i)var a=i.dgst;return i=a,s=Error(ie(419)),i=jh(s,i,void 0),Gl(n,e,o,i)}if(a=(o&n.childLanes)!==0,Sn||a){if(i=Gt,i!==null){switch(o&-o){case 4:r=2;break;case 16:r=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:r=32;break;case 536870912:r=268435456;break;default:r=0}r=(r&(i.suspendedLanes|o))!==0?0:r,r!==0&&r!==s.retryLane&&(s.retryLane=r,Oi(n,r),si(i,n,r,-1))}return Cf(),i=jh(Error(ie(421))),Gl(n,e,o,i)}return r.data==="$?"?(e.flags|=128,e.child=n.child,e=g1.bind(null,n),r._reactRetry=e,null):(n=s.treeContext,In=pr(r.nextSibling),Ln=e,_t=!0,ii=null,n!==null&&(Gn[Wn++]=Ii,Gn[Wn++]=Li,Gn[Wn++]=Qr,Ii=n.id,Li=n.overflow,Qr=e),e=wf(e,i.children),e.flags|=4096,e)}function u0(n,e,t){n.lanes|=e;var i=n.alternate;i!==null&&(i.lanes|=e),bd(n.return,e,t)}function Kh(n,e,t,i,r){var s=n.memoizedState;s===null?n.memoizedState={isBackwards:e,rendering:null,renderingStartTime:0,last:i,tail:t,tailMode:r}:(s.isBackwards=e,s.rendering=null,s.renderingStartTime=0,s.last=i,s.tail=t,s.tailMode=r)}function ey(n,e,t){var i=e.pendingProps,r=i.revealOrder,s=i.tail;if(fn(n,e,i.children,t),i=xt.current,(i&2)!==0)i=i&1|2,e.flags|=128;else{if(n!==null&&(n.flags&128)!==0)e:for(n=e.child;n!==null;){if(n.tag===13)n.memoizedState!==null&&u0(n,t,e);else if(n.tag===19)u0(n,t,e);else if(n.child!==null){n.child.return=n,n=n.child;continue}if(n===e)break e;for(;n.sibling===null;){if(n.return===null||n.return===e)break e;n=n.return}n.sibling.return=n.return,n=n.sibling}i&=1}if(dt(xt,i),(e.mode&1)===0)e.memoizedState=null;else switch(r){case"forwards":for(t=e.child,r=null;t!==null;)n=t.alternate,n!==null&&yc(n)===null&&(r=t),t=t.sibling;t=r,t===null?(r=e.child,e.child=null):(r=t.sibling,t.sibling=null),Kh(e,!1,r,t,s);break;case"backwards":for(t=null,r=e.child,e.child=null;r!==null;){if(n=r.alternate,n!==null&&yc(n)===null){e.child=r;break}n=r.sibling,r.sibling=t,t=r,r=n}Kh(e,!0,t,null,s);break;case"together":Kh(e,!1,null,null,void 0);break;default:e.memoizedState=null}return e.child}function Jl(n,e){(e.mode&1)===0&&n!==null&&(n.alternate=null,e.alternate=null,e.flags|=2)}function Fi(n,e,t){if(n!==null&&(e.dependencies=n.dependencies),ts|=e.lanes,(t&e.childLanes)===0)return null;if(n!==null&&e.child!==n.child)throw Error(ie(153));if(e.child!==null){for(n=e.child,t=yr(n,n.pendingProps),e.child=t,t.return=e;n.sibling!==null;)n=n.sibling,t=t.sibling=yr(n,n.pendingProps),t.return=e;t.sibling=null}return e.child}function r1(n,e,t){switch(e.tag){case 3:Jv(e),Xs();break;case 5:bv(e);break;case 1:En(e.type)&&dc(e);break;case 4:mf(e,e.stateNode.containerInfo);break;case 10:var i=e.type._context,r=e.memoizedProps.value;dt(mc,i._currentValue),i._currentValue=r;break;case 13:if(i=e.memoizedState,i!==null)return i.dehydrated!==null?(dt(xt,xt.current&1),e.flags|=128,null):(t&e.child.childLanes)!==0?Qv(n,e,t):(dt(xt,xt.current&1),n=Fi(n,e,t),n!==null?n.sibling:null);dt(xt,xt.current&1);break;case 19:if(i=(t&e.childLanes)!==0,(n.flags&128)!==0){if(i)return ey(n,e,t);e.flags|=128}if(r=e.memoizedState,r!==null&&(r.rendering=null,r.tail=null,r.lastEffect=null),dt(xt,xt.current),i)break;return null;case 22:case 23:return e.lanes=0,Zv(n,e,t)}return Fi(n,e,t)}var ty,Ud,ny,iy;ty=function(n,e){for(var t=e.child;t!==null;){if(t.tag===5||t.tag===6)n.appendChild(t.stateNode);else if(t.tag!==4&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return;t=t.return}t.sibling.return=t.return,t=t.sibling}};Ud=function(){};ny=function(n,e,t,i){var r=n.memoizedProps;if(r!==i){n=e.stateNode,Kr(_i.current);var s=null;switch(t){case"input":r=id(n,r),i=id(n,i),s=[];break;case"select":r=St({},r,{value:void 0}),i=St({},i,{value:void 0}),s=[];break;case"textarea":r=od(n,r),i=od(n,i),s=[];break;default:typeof r.onClick!="function"&&typeof i.onClick=="function"&&(n.onclick=uc)}ld(t,i);var o;t=null;for(c in r)if(!i.hasOwnProperty(c)&&r.hasOwnProperty(c)&&r[c]!=null)if(c==="style"){var a=r[c];for(o in a)a.hasOwnProperty(o)&&(t||(t={}),t[o]="")}else c!=="dangerouslySetInnerHTML"&&c!=="children"&&c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&c!=="autoFocus"&&(ya.hasOwnProperty(c)?s||(s=[]):(s=s||[]).push(c,null));for(c in i){var l=i[c];if(a=r?.[c],i.hasOwnProperty(c)&&l!==a&&(l!=null||a!=null))if(c==="style")if(a){for(o in a)!a.hasOwnProperty(o)||l&&l.hasOwnProperty(o)||(t||(t={}),t[o]="");for(o in l)l.hasOwnProperty(o)&&a[o]!==l[o]&&(t||(t={}),t[o]=l[o])}else t||(s||(s=[]),s.push(c,t)),t=l;else c==="dangerouslySetInnerHTML"?(l=l?l.__html:void 0,a=a?a.__html:void 0,l!=null&&a!==l&&(s=s||[]).push(c,l)):c==="children"?typeof l!="string"&&typeof l!="number"||(s=s||[]).push(c,""+l):c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&(ya.hasOwnProperty(c)?(l!=null&&c==="onScroll"&&ft("scroll",n),s||a===l||(s=[])):(s=s||[]).push(c,l))}t&&(s=s||[]).push("style",t);var c=s;(e.updateQueue=c)&&(e.flags|=4)}};iy=function(n,e,t,i){t!==i&&(e.flags|=4)};function na(n,e){if(!_t)switch(n.tailMode){case"hidden":e=n.tail;for(var t=null;e!==null;)e.alternate!==null&&(t=e),e=e.sibling;t===null?n.tail=null:t.sibling=null;break;case"collapsed":t=n.tail;for(var i=null;t!==null;)t.alternate!==null&&(i=t),t=t.sibling;i===null?e||n.tail===null?n.tail=null:n.tail.sibling=null:i.sibling=null}}function nn(n){var e=n.alternate!==null&&n.alternate.child===n.child,t=0,i=0;if(e)for(var r=n.child;r!==null;)t|=r.lanes|r.childLanes,i|=r.subtreeFlags&14680064,i|=r.flags&14680064,r.return=n,r=r.sibling;else for(r=n.child;r!==null;)t|=r.lanes|r.childLanes,i|=r.subtreeFlags,i|=r.flags,r.return=n,r=r.sibling;return n.subtreeFlags|=i,n.childLanes=t,e}function s1(n,e,t){var i=e.pendingProps;switch(lf(e),e.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return nn(e),null;case 1:return En(e.type)&&hc(),nn(e),null;case 3:return i=e.stateNode,Ys(),pt(wn),pt(sn),vf(),i.pendingContext&&(i.context=i.pendingContext,i.pendingContext=null),(n===null||n.child===null)&&(Vl(e)?e.flags|=4:n===null||n.memoizedState.isDehydrated&&(e.flags&256)===0||(e.flags|=1024,ii!==null&&(Gd(ii),ii=null))),Ud(n,e),nn(e),null;case 5:gf(e);var r=Kr(Pa.current);if(t=e.type,n!==null&&e.stateNode!=null)ny(n,e,t,i,r),n.ref!==e.ref&&(e.flags|=512,e.flags|=2097152);else{if(!i){if(e.stateNode===null)throw Error(ie(166));return nn(e),null}if(n=Kr(_i.current),Vl(e)){i=e.stateNode,t=e.type;var s=e.memoizedProps;switch(i[vi]=e,i[Ra]=s,n=(e.mode&1)!==0,t){case"dialog":ft("cancel",i),ft("close",i);break;case"iframe":case"object":case"embed":ft("load",i);break;case"video":case"audio":for(r=0;r<la.length;r++)ft(la[r],i);break;case"source":ft("error",i);break;case"img":case"image":case"link":ft("error",i),ft("load",i);break;case"details":ft("toggle",i);break;case"input":yg(i,s),ft("invalid",i);break;case"select":i._wrapperState={wasMultiple:!!s.multiple},ft("invalid",i);break;case"textarea":xg(i,s),ft("invalid",i)}ld(t,s),r=null;for(var o in s)if(s.hasOwnProperty(o)){var a=s[o];o==="children"?typeof a=="string"?i.textContent!==a&&(s.suppressHydrationWarning!==!0&&Bl(i.textContent,a,n),r=["children",a]):typeof a=="number"&&i.textContent!==""+a&&(s.suppressHydrationWarning!==!0&&Bl(i.textContent,a,n),r=["children",""+a]):ya.hasOwnProperty(o)&&a!=null&&o==="onScroll"&&ft("scroll",i)}switch(t){case"input":Rl(i),_g(i,s,!0);break;case"textarea":Rl(i),Mg(i);break;case"select":case"option":break;default:typeof s.onClick=="function"&&(i.onclick=uc)}i=r,e.updateQueue=i,i!==null&&(e.flags|=4)}else{o=r.nodeType===9?r:r.ownerDocument,n==="http://www.w3.org/1999/xhtml"&&(n=P0(t)),n==="http://www.w3.org/1999/xhtml"?t==="script"?(n=o.createElement("div"),n.innerHTML="<script><\/script>",n=n.removeChild(n.firstChild)):typeof i.is=="string"?n=o.createElement(t,{is:i.is}):(n=o.createElement(t),t==="select"&&(o=n,i.multiple?o.multiple=!0:i.size&&(o.size=i.size))):n=o.createElementNS(n,t),n[vi]=e,n[Ra]=i,ty(n,e,!1,!1),e.stateNode=n;e:{switch(o=cd(t,i),t){case"dialog":ft("cancel",n),ft("close",n),r=i;break;case"iframe":case"object":case"embed":ft("load",n),r=i;break;case"video":case"audio":for(r=0;r<la.length;r++)ft(la[r],n);r=i;break;case"source":ft("error",n),r=i;break;case"img":case"image":case"link":ft("error",n),ft("load",n),r=i;break;case"details":ft("toggle",n),r=i;break;case"input":yg(n,i),r=id(n,i),ft("invalid",n);break;case"option":r=i;break;case"select":n._wrapperState={wasMultiple:!!i.multiple},r=St({},i,{value:void 0}),ft("invalid",n);break;case"textarea":xg(n,i),r=od(n,i),ft("invalid",n);break;default:r=i}ld(t,r),a=r;for(s in a)if(a.hasOwnProperty(s)){var l=a[s];s==="style"?N0(n,l):s==="dangerouslySetInnerHTML"?(l=l?l.__html:void 0,l!=null&&I0(n,l)):s==="children"?typeof l=="string"?(t!=="textarea"||l!=="")&&_a(n,l):typeof l=="number"&&_a(n,""+l):s!=="suppressContentEditableWarning"&&s!=="suppressHydrationWarning"&&s!=="autoFocus"&&(ya.hasOwnProperty(s)?l!=null&&s==="onScroll"&&ft("scroll",n):l!=null&&qd(n,s,l,o))}switch(t){case"input":Rl(n),_g(n,i,!1);break;case"textarea":Rl(n),Mg(n);break;case"option":i.value!=null&&n.setAttribute("value",""+_r(i.value));break;case"select":n.multiple=!!i.multiple,s=i.value,s!=null?Fs(n,!!i.multiple,s,!1):i.defaultValue!=null&&Fs(n,!!i.multiple,i.defaultValue,!0);break;default:typeof r.onClick=="function"&&(n.onclick=uc)}switch(t){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break e;case"img":i=!0;break e;default:i=!1}}i&&(e.flags|=4)}e.ref!==null&&(e.flags|=512,e.flags|=2097152)}return nn(e),null;case 6:if(n&&e.stateNode!=null)iy(n,e,n.memoizedProps,i);else{if(typeof i!="string"&&e.stateNode===null)throw Error(ie(166));if(t=Kr(Pa.current),Kr(_i.current),Vl(e)){if(i=e.stateNode,t=e.memoizedProps,i[vi]=e,(s=i.nodeValue!==t)&&(n=Ln,n!==null))switch(n.tag){case 3:Bl(i.nodeValue,t,(n.mode&1)!==0);break;case 5:n.memoizedProps.suppressHydrationWarning!==!0&&Bl(i.nodeValue,t,(n.mode&1)!==0)}s&&(e.flags|=4)}else i=(t.nodeType===9?t:t.ownerDocument).createTextNode(i),i[vi]=e,e.stateNode=i}return nn(e),null;case 13:if(pt(xt),i=e.memoizedState,n===null||n.memoizedState!==null&&n.memoizedState.dehydrated!==null){if(_t&&In!==null&&(e.mode&1)!==0&&(e.flags&128)===0)xv(),Xs(),e.flags|=98560,s=!1;else if(s=Vl(e),i!==null&&i.dehydrated!==null){if(n===null){if(!s)throw Error(ie(318));if(s=e.memoizedState,s=s!==null?s.dehydrated:null,!s)throw Error(ie(317));s[vi]=e}else Xs(),(e.flags&128)===0&&(e.memoizedState=null),e.flags|=4;nn(e),s=!1}else ii!==null&&(Gd(ii),ii=null),s=!0;if(!s)return e.flags&65536?e:null}return(e.flags&128)!==0?(e.lanes=t,e):(i=i!==null,i!==(n!==null&&n.memoizedState!==null)&&i&&(e.child.flags|=8192,(e.mode&1)!==0&&(n===null||(xt.current&1)!==0?Ot===0&&(Ot=3):Cf())),e.updateQueue!==null&&(e.flags|=4),nn(e),null);case 4:return Ys(),Ud(n,e),n===null&&Aa(e.stateNode.containerInfo),nn(e),null;case 10:return df(e.type._context),nn(e),null;case 17:return En(e.type)&&hc(),nn(e),null;case 19:if(pt(xt),s=e.memoizedState,s===null)return nn(e),null;if(i=(e.flags&128)!==0,o=s.rendering,o===null)if(i)na(s,!1);else{if(Ot!==0||n!==null&&(n.flags&128)!==0)for(n=e.child;n!==null;){if(o=yc(n),o!==null){for(e.flags|=128,na(s,!1),i=o.updateQueue,i!==null&&(e.updateQueue=i,e.flags|=4),e.subtreeFlags=0,i=t,t=e.child;t!==null;)s=t,n=i,s.flags&=14680066,o=s.alternate,o===null?(s.childLanes=0,s.lanes=n,s.child=null,s.subtreeFlags=0,s.memoizedProps=null,s.memoizedState=null,s.updateQueue=null,s.dependencies=null,s.stateNode=null):(s.childLanes=o.childLanes,s.lanes=o.lanes,s.child=o.child,s.subtreeFlags=0,s.deletions=null,s.memoizedProps=o.memoizedProps,s.memoizedState=o.memoizedState,s.updateQueue=o.updateQueue,s.type=o.type,n=o.dependencies,s.dependencies=n===null?null:{lanes:n.lanes,firstContext:n.firstContext}),t=t.sibling;return dt(xt,xt.current&1|2),e.child}n=n.sibling}s.tail!==null&&Rt()>Ks&&(e.flags|=128,i=!0,na(s,!1),e.lanes=4194304)}else{if(!i)if(n=yc(o),n!==null){if(e.flags|=128,i=!0,t=n.updateQueue,t!==null&&(e.updateQueue=t,e.flags|=4),na(s,!0),s.tail===null&&s.tailMode==="hidden"&&!o.alternate&&!_t)return nn(e),null}else 2*Rt()-s.renderingStartTime>Ks&&t!==1073741824&&(e.flags|=128,i=!0,na(s,!1),e.lanes=4194304);s.isBackwards?(o.sibling=e.child,e.child=o):(t=s.last,t!==null?t.sibling=o:e.child=o,s.last=o)}return s.tail!==null?(e=s.tail,s.rendering=e,s.tail=e.sibling,s.renderingStartTime=Rt(),e.sibling=null,t=xt.current,dt(xt,i?t&1|2:t&1),e):(nn(e),null);case 22:case 23:return Rf(),i=e.memoizedState!==null,n!==null&&n.memoizedState!==null!==i&&(e.flags|=8192),i&&(e.mode&1)!==0?(Pn&1073741824)!==0&&(nn(e),e.subtreeFlags&6&&(e.flags|=8192)):nn(e),null;case 24:return null;case 25:return null}throw Error(ie(156,e.tag))}function o1(n,e){switch(lf(e),e.tag){case 1:return En(e.type)&&hc(),n=e.flags,n&65536?(e.flags=n&-65537|128,e):null;case 3:return Ys(),pt(wn),pt(sn),vf(),n=e.flags,(n&65536)!==0&&(n&128)===0?(e.flags=n&-65537|128,e):null;case 5:return gf(e),null;case 13:if(pt(xt),n=e.memoizedState,n!==null&&n.dehydrated!==null){if(e.alternate===null)throw Error(ie(340));Xs()}return n=e.flags,n&65536?(e.flags=n&-65537|128,e):null;case 19:return pt(xt),null;case 4:return Ys(),null;case 10:return df(e.type._context),null;case 22:case 23:return Rf(),null;case 24:return null;default:return null}}var Wl=!1,rn=!1,a1=typeof WeakSet=="function"?WeakSet:Set,ge=null;function Us(n,e){var t=n.ref;if(t!==null)if(typeof t=="function")try{t(null)}catch(i){At(n,e,i)}else t.current=null}function Od(n,e,t){try{t()}catch(i){At(n,e,i)}}var h0=!1;function l1(n,e){if(_d=ac,n=av(),of(n)){if("selectionStart"in n)var t={start:n.selectionStart,end:n.selectionEnd};else e:{t=(t=n.ownerDocument)&&t.defaultView||window;var i=t.getSelection&&t.getSelection();if(i&&i.rangeCount!==0){t=i.anchorNode;var r=i.anchorOffset,s=i.focusNode;i=i.focusOffset;try{t.nodeType,s.nodeType}catch{t=null;break e}var o=0,a=-1,l=-1,c=0,u=0,h=n,d=null;t:for(;;){for(var p;h!==t||r!==0&&h.nodeType!==3||(a=o+r),h!==s||i!==0&&h.nodeType!==3||(l=o+i),h.nodeType===3&&(o+=h.nodeValue.length),(p=h.firstChild)!==null;)d=h,h=p;for(;;){if(h===n)break t;if(d===t&&++c===r&&(a=o),d===s&&++u===i&&(l=o),(p=h.nextSibling)!==null)break;h=d,d=h.parentNode}h=p}t=a===-1||l===-1?null:{start:a,end:l}}else t=null}t=t||{start:0,end:0}}else t=null;for(xd={focusedElem:n,selectionRange:t},ac=!1,ge=e;ge!==null;)if(e=ge,n=e.child,(e.subtreeFlags&1028)!==0&&n!==null)n.return=e,ge=n;else for(;ge!==null;){e=ge;try{var v=e.alternate;if((e.flags&1024)!==0)switch(e.tag){case 0:case 11:case 15:break;case 1:if(v!==null){var _=v.memoizedProps,m=v.memoizedState,f=e.stateNode,g=f.getSnapshotBeforeUpdate(e.elementType===e.type?_:ti(e.type,_),m);f.__reactInternalSnapshotBeforeUpdate=g}break;case 3:var y=e.stateNode.containerInfo;y.nodeType===1?y.textContent="":y.nodeType===9&&y.documentElement&&y.removeChild(y.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(ie(163))}}catch(x){At(e,e.return,x)}if(n=e.sibling,n!==null){n.return=e.return,ge=n;break}ge=e.return}return v=h0,h0=!1,v}function ma(n,e,t){var i=e.updateQueue;if(i=i!==null?i.lastEffect:null,i!==null){var r=i=i.next;do{if((r.tag&n)===n){var s=r.destroy;r.destroy=void 0,s!==void 0&&Od(e,t,s)}r=r.next}while(r!==i)}}function Dc(n,e){if(e=e.updateQueue,e=e!==null?e.lastEffect:null,e!==null){var t=e=e.next;do{if((t.tag&n)===n){var i=t.create;t.destroy=i()}t=t.next}while(t!==e)}}function Fd(n){var e=n.ref;if(e!==null){var t=n.stateNode;n.tag,n=t,typeof e=="function"?e(n):e.current=n}}function ry(n){var e=n.alternate;e!==null&&(n.alternate=null,ry(e)),n.child=null,n.deletions=null,n.sibling=null,n.tag===5&&(e=n.stateNode,e!==null&&(delete e[vi],delete e[Ra],delete e[wd],delete e[WS],delete e[XS])),n.stateNode=null,n.return=null,n.dependencies=null,n.memoizedProps=null,n.memoizedState=null,n.pendingProps=null,n.stateNode=null,n.updateQueue=null}function sy(n){return n.tag===5||n.tag===3||n.tag===4}function d0(n){e:for(;;){for(;n.sibling===null;){if(n.return===null||sy(n.return))return null;n=n.return}for(n.sibling.return=n.return,n=n.sibling;n.tag!==5&&n.tag!==6&&n.tag!==18;){if(n.flags&2||n.child===null||n.tag===4)continue e;n.child.return=n,n=n.child}if(!(n.flags&2))return n.stateNode}}function kd(n,e,t){var i=n.tag;if(i===5||i===6)n=n.stateNode,e?t.nodeType===8?t.parentNode.insertBefore(n,e):t.insertBefore(n,e):(t.nodeType===8?(e=t.parentNode,e.insertBefore(n,t)):(e=t,e.appendChild(n)),t=t._reactRootContainer,t!=null||e.onclick!==null||(e.onclick=uc));else if(i!==4&&(n=n.child,n!==null))for(kd(n,e,t),n=n.sibling;n!==null;)kd(n,e,t),n=n.sibling}function zd(n,e,t){var i=n.tag;if(i===5||i===6)n=n.stateNode,e?t.insertBefore(n,e):t.appendChild(n);else if(i!==4&&(n=n.child,n!==null))for(zd(n,e,t),n=n.sibling;n!==null;)zd(n,e,t),n=n.sibling}var Kt=null,ni=!1;function rr(n,e,t){for(t=t.child;t!==null;)oy(n,e,t),t=t.sibling}function oy(n,e,t){if(yi&&typeof yi.onCommitFiberUnmount=="function")try{yi.onCommitFiberUnmount(Ac,t)}catch{}switch(t.tag){case 5:rn||Us(t,e);case 6:var i=Kt,r=ni;Kt=null,rr(n,e,t),Kt=i,ni=r,Kt!==null&&(ni?(n=Kt,t=t.stateNode,n.nodeType===8?n.parentNode.removeChild(t):n.removeChild(t)):Kt.removeChild(t.stateNode));break;case 18:Kt!==null&&(ni?(n=Kt,t=t.stateNode,n.nodeType===8?Hh(n.parentNode,t):n.nodeType===1&&Hh(n,t),wa(n)):Hh(Kt,t.stateNode));break;case 4:i=Kt,r=ni,Kt=t.stateNode.containerInfo,ni=!0,rr(n,e,t),Kt=i,ni=r;break;case 0:case 11:case 14:case 15:if(!rn&&(i=t.updateQueue,i!==null&&(i=i.lastEffect,i!==null))){r=i=i.next;do{var s=r,o=s.destroy;s=s.tag,o!==void 0&&((s&2)!==0||(s&4)!==0)&&Od(t,e,o),r=r.next}while(r!==i)}rr(n,e,t);break;case 1:if(!rn&&(Us(t,e),i=t.stateNode,typeof i.componentWillUnmount=="function"))try{i.props=t.memoizedProps,i.state=t.memoizedState,i.componentWillUnmount()}catch(a){At(t,e,a)}rr(n,e,t);break;case 21:rr(n,e,t);break;case 22:t.mode&1?(rn=(i=rn)||t.memoizedState!==null,rr(n,e,t),rn=i):rr(n,e,t);break;default:rr(n,e,t)}}function f0(n){var e=n.updateQueue;if(e!==null){n.updateQueue=null;var t=n.stateNode;t===null&&(t=n.stateNode=new a1),e.forEach(function(i){var r=v1.bind(null,n,i);t.has(i)||(t.add(i),i.then(r,r))})}}function ei(n,e){var t=e.deletions;if(t!==null)for(var i=0;i<t.length;i++){var r=t[i];try{var s=n,o=e,a=o;e:for(;a!==null;){switch(a.tag){case 5:Kt=a.stateNode,ni=!1;break e;case 3:Kt=a.stateNode.containerInfo,ni=!0;break e;case 4:Kt=a.stateNode.containerInfo,ni=!0;break e}a=a.return}if(Kt===null)throw Error(ie(160));oy(s,o,r),Kt=null,ni=!1;var l=r.alternate;l!==null&&(l.return=null),r.return=null}catch(c){At(r,e,c)}}if(e.subtreeFlags&12854)for(e=e.child;e!==null;)ay(e,n),e=e.sibling}function ay(n,e){var t=n.alternate,i=n.flags;switch(n.tag){case 0:case 11:case 14:case 15:if(ei(e,n),mi(n),i&4){try{ma(3,n,n.return),Dc(3,n)}catch(_){At(n,n.return,_)}try{ma(5,n,n.return)}catch(_){At(n,n.return,_)}}break;case 1:ei(e,n),mi(n),i&512&&t!==null&&Us(t,t.return);break;case 5:if(ei(e,n),mi(n),i&512&&t!==null&&Us(t,t.return),n.flags&32){var r=n.stateNode;try{_a(r,"")}catch(_){At(n,n.return,_)}}if(i&4&&(r=n.stateNode,r!=null)){var s=n.memoizedProps,o=t!==null?t.memoizedProps:s,a=n.type,l=n.updateQueue;if(n.updateQueue=null,l!==null)try{a==="input"&&s.type==="radio"&&s.name!=null&&R0(r,s),cd(a,o);var c=cd(a,s);for(o=0;o<l.length;o+=2){var u=l[o],h=l[o+1];u==="style"?N0(r,h):u==="dangerouslySetInnerHTML"?I0(r,h):u==="children"?_a(r,h):qd(r,u,h,c)}switch(a){case"input":rd(r,s);break;case"textarea":C0(r,s);break;case"select":var d=r._wrapperState.wasMultiple;r._wrapperState.wasMultiple=!!s.multiple;var p=s.value;p!=null?Fs(r,!!s.multiple,p,!1):d!==!!s.multiple&&(s.defaultValue!=null?Fs(r,!!s.multiple,s.defaultValue,!0):Fs(r,!!s.multiple,s.multiple?[]:"",!1))}r[Ra]=s}catch(_){At(n,n.return,_)}}break;case 6:if(ei(e,n),mi(n),i&4){if(n.stateNode===null)throw Error(ie(162));r=n.stateNode,s=n.memoizedProps;try{r.nodeValue=s}catch(_){At(n,n.return,_)}}break;case 3:if(ei(e,n),mi(n),i&4&&t!==null&&t.memoizedState.isDehydrated)try{wa(e.containerInfo)}catch(_){At(n,n.return,_)}break;case 4:ei(e,n),mi(n);break;case 13:ei(e,n),mi(n),r=n.child,r.flags&8192&&(s=r.memoizedState!==null,r.stateNode.isHidden=s,!s||r.alternate!==null&&r.alternate.memoizedState!==null||(Af=Rt())),i&4&&f0(n);break;case 22:if(u=t!==null&&t.memoizedState!==null,n.mode&1?(rn=(c=rn)||u,ei(e,n),rn=c):ei(e,n),mi(n),i&8192){if(c=n.memoizedState!==null,(n.stateNode.isHidden=c)&&!u&&(n.mode&1)!==0)for(ge=n,u=n.child;u!==null;){for(h=ge=u;ge!==null;){switch(d=ge,p=d.child,d.tag){case 0:case 11:case 14:case 15:ma(4,d,d.return);break;case 1:Us(d,d.return);var v=d.stateNode;if(typeof v.componentWillUnmount=="function"){i=d,t=d.return;try{e=i,v.props=e.memoizedProps,v.state=e.memoizedState,v.componentWillUnmount()}catch(_){At(i,t,_)}}break;case 5:Us(d,d.return);break;case 22:if(d.memoizedState!==null){m0(h);continue}}p!==null?(p.return=d,ge=p):m0(h)}u=u.sibling}e:for(u=null,h=n;;){if(h.tag===5){if(u===null){u=h;try{r=h.stateNode,c?(s=r.style,typeof s.setProperty=="function"?s.setProperty("display","none","important"):s.display="none"):(a=h.stateNode,l=h.memoizedProps.style,o=l!=null&&l.hasOwnProperty("display")?l.display:null,a.style.display=L0("display",o))}catch(_){At(n,n.return,_)}}}else if(h.tag===6){if(u===null)try{h.stateNode.nodeValue=c?"":h.memoizedProps}catch(_){At(n,n.return,_)}}else if((h.tag!==22&&h.tag!==23||h.memoizedState===null||h===n)&&h.child!==null){h.child.return=h,h=h.child;continue}if(h===n)break e;for(;h.sibling===null;){if(h.return===null||h.return===n)break e;u===h&&(u=null),h=h.return}u===h&&(u=null),h.sibling.return=h.return,h=h.sibling}}break;case 19:ei(e,n),mi(n),i&4&&f0(n);break;case 21:break;default:ei(e,n),mi(n)}}function mi(n){var e=n.flags;if(e&2){try{e:{for(var t=n.return;t!==null;){if(sy(t)){var i=t;break e}t=t.return}throw Error(ie(160))}switch(i.tag){case 5:var r=i.stateNode;i.flags&32&&(_a(r,""),i.flags&=-33);var s=d0(n);zd(n,s,r);break;case 3:case 4:var o=i.stateNode.containerInfo,a=d0(n);kd(n,a,o);break;default:throw Error(ie(161))}}catch(l){At(n,n.return,l)}n.flags&=-3}e&4096&&(n.flags&=-4097)}function c1(n,e,t){ge=n,ly(n,e,t)}function ly(n,e,t){for(var i=(n.mode&1)!==0;ge!==null;){var r=ge,s=r.child;if(r.tag===22&&i){var o=r.memoizedState!==null||Wl;if(!o){var a=r.alternate,l=a!==null&&a.memoizedState!==null||rn;a=Wl;var c=rn;if(Wl=o,(rn=l)&&!c)for(ge=r;ge!==null;)o=ge,l=o.child,o.tag===22&&o.memoizedState!==null?g0(r):l!==null?(l.return=o,ge=l):g0(r);for(;s!==null;)ge=s,ly(s,e,t),s=s.sibling;ge=r,Wl=a,rn=c}p0(n,e,t)}else(r.subtreeFlags&8772)!==0&&s!==null?(s.return=r,ge=s):p0(n,e,t)}}function p0(n){for(;ge!==null;){var e=ge;if((e.flags&8772)!==0){var t=e.alternate;try{if((e.flags&8772)!==0)switch(e.tag){case 0:case 11:case 15:rn||Dc(5,e);break;case 1:var i=e.stateNode;if(e.flags&4&&!rn)if(t===null)i.componentDidMount();else{var r=e.elementType===e.type?t.memoizedProps:ti(e.type,t.memoizedProps);i.componentDidUpdate(r,t.memoizedState,i.__reactInternalSnapshotBeforeUpdate)}var s=e.updateQueue;s!==null&&$g(e,s,i);break;case 3:var o=e.updateQueue;if(o!==null){if(t=null,e.child!==null)switch(e.child.tag){case 5:t=e.child.stateNode;break;case 1:t=e.child.stateNode}$g(e,o,t)}break;case 5:var a=e.stateNode;if(t===null&&e.flags&4){t=a;var l=e.memoizedProps;switch(e.type){case"button":case"input":case"select":case"textarea":l.autoFocus&&t.focus();break;case"img":l.src&&(t.src=l.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(e.memoizedState===null){var c=e.alternate;if(c!==null){var u=c.memoizedState;if(u!==null){var h=u.dehydrated;h!==null&&wa(h)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(ie(163))}rn||e.flags&512&&Fd(e)}catch(d){At(e,e.return,d)}}if(e===n){ge=null;break}if(t=e.sibling,t!==null){t.return=e.return,ge=t;break}ge=e.return}}function m0(n){for(;ge!==null;){var e=ge;if(e===n){ge=null;break}var t=e.sibling;if(t!==null){t.return=e.return,ge=t;break}ge=e.return}}function g0(n){for(;ge!==null;){var e=ge;try{switch(e.tag){case 0:case 11:case 15:var t=e.return;try{Dc(4,e)}catch(l){At(e,t,l)}break;case 1:var i=e.stateNode;if(typeof i.componentDidMount=="function"){var r=e.return;try{i.componentDidMount()}catch(l){At(e,r,l)}}var s=e.return;try{Fd(e)}catch(l){At(e,s,l)}break;case 5:var o=e.return;try{Fd(e)}catch(l){At(e,o,l)}}}catch(l){At(e,e.return,l)}if(e===n){ge=null;break}var a=e.sibling;if(a!==null){a.return=e.return,ge=a;break}ge=e.return}}var u1=Math.ceil,Mc=ki.ReactCurrentDispatcher,Ef=ki.ReactCurrentOwner,qn=ki.ReactCurrentBatchConfig,et=0,Gt=null,Lt=null,Zt=0,Pn=0,Os=Sr(0),Ot=0,Da=null,ts=0,Uc=0,Tf=0,ga=null,Mn=null,Af=0,Ks=1/0,Ci=null,Sc=!1,Bd=null,gr=null,Xl=!1,ur=null,wc=0,va=0,Vd=null,Ql=-1,ec=0;function pn(){return(et&6)!==0?Rt():Ql!==-1?Ql:Ql=Rt()}function vr(n){return(n.mode&1)===0?1:(et&2)!==0&&Zt!==0?Zt&-Zt:YS.transition!==null?(ec===0&&(ec=X0()),ec):(n=ot,n!==0||(n=window.event,n=n===void 0?16:J0(n.type)),n)}function si(n,e,t,i){if(50<va)throw va=0,Vd=null,Error(ie(185));Ua(n,t,i),((et&2)===0||n!==Gt)&&(n===Gt&&((et&2)===0&&(Uc|=t),Ot===4&&lr(n,Zt)),Tn(n,i),t===1&&et===0&&(e.mode&1)===0&&(Ks=Rt()+500,Ic&&wr()))}function Tn(n,e){var t=n.callbackNode;KM(n,e);var i=oc(n,n===Gt?Zt:0);if(i===0)t!==null&&Eg(t),n.callbackNode=null,n.callbackPriority=0;else if(e=i&-i,n.callbackPriority!==e){if(t!=null&&Eg(t),e===1)n.tag===0?qS(v0.bind(null,n)):vv(v0.bind(null,n)),HS(function(){(et&6)===0&&wr()}),t=null;else{switch(q0(i)){case 1:t=$d;break;case 4:t=G0;break;case 16:t=sc;break;case 536870912:t=W0;break;default:t=sc}t=gy(t,cy.bind(null,n))}n.callbackPriority=e,n.callbackNode=t}}function cy(n,e){if(Ql=-1,ec=0,(et&6)!==0)throw Error(ie(327));var t=n.callbackNode;if(Hs()&&n.callbackNode!==t)return null;var i=oc(n,n===Gt?Zt:0);if(i===0)return null;if((i&30)!==0||(i&n.expiredLanes)!==0||e)e=Ec(n,i);else{e=i;var r=et;et|=2;var s=hy();(Gt!==n||Zt!==e)&&(Ci=null,Ks=Rt()+500,Zr(n,e));do try{f1();break}catch(a){uy(n,a)}while(!0);hf(),Mc.current=s,et=r,Lt!==null?e=0:(Gt=null,Zt=0,e=Ot)}if(e!==0){if(e===2&&(r=pd(n),r!==0&&(i=r,e=Hd(n,r))),e===1)throw t=Da,Zr(n,0),lr(n,i),Tn(n,Rt()),t;if(e===6)lr(n,i);else{if(r=n.current.alternate,(i&30)===0&&!h1(r)&&(e=Ec(n,i),e===2&&(s=pd(n),s!==0&&(i=s,e=Hd(n,s))),e===1))throw t=Da,Zr(n,0),lr(n,i),Tn(n,Rt()),t;switch(n.finishedWork=r,n.finishedLanes=i,e){case 0:case 1:throw Error(ie(345));case 2:qr(n,Mn,Ci);break;case 3:if(lr(n,i),(i&130023424)===i&&(e=Af+500-Rt(),10<e)){if(oc(n,0)!==0)break;if(r=n.suspendedLanes,(r&i)!==i){pn(),n.pingedLanes|=n.suspendedLanes&r;break}n.timeoutHandle=Sd(qr.bind(null,n,Mn,Ci),e);break}qr(n,Mn,Ci);break;case 4:if(lr(n,i),(i&4194240)===i)break;for(e=n.eventTimes,r=-1;0<i;){var o=31-ri(i);s=1<<o,o=e[o],o>r&&(r=o),i&=~s}if(i=r,i=Rt()-i,i=(120>i?120:480>i?480:1080>i?1080:1920>i?1920:3e3>i?3e3:4320>i?4320:1960*u1(i/1960))-i,10<i){n.timeoutHandle=Sd(qr.bind(null,n,Mn,Ci),i);break}qr(n,Mn,Ci);break;case 5:qr(n,Mn,Ci);break;default:throw Error(ie(329))}}}return Tn(n,Rt()),n.callbackNode===t?cy.bind(null,n):null}function Hd(n,e){var t=ga;return n.current.memoizedState.isDehydrated&&(Zr(n,e).flags|=256),n=Ec(n,e),n!==2&&(e=Mn,Mn=t,e!==null&&Gd(e)),n}function Gd(n){Mn===null?Mn=n:Mn.push.apply(Mn,n)}function h1(n){for(var e=n;;){if(e.flags&16384){var t=e.updateQueue;if(t!==null&&(t=t.stores,t!==null))for(var i=0;i<t.length;i++){var r=t[i],s=r.getSnapshot;r=r.value;try{if(!oi(s(),r))return!1}catch{return!1}}}if(t=e.child,e.subtreeFlags&16384&&t!==null)t.return=e,e=t;else{if(e===n)break;for(;e.sibling===null;){if(e.return===null||e.return===n)return!0;e=e.return}e.sibling.return=e.return,e=e.sibling}}return!0}function lr(n,e){for(e&=~Tf,e&=~Uc,n.suspendedLanes|=e,n.pingedLanes&=~e,n=n.expirationTimes;0<e;){var t=31-ri(e),i=1<<t;n[t]=-1,e&=~i}}function v0(n){if((et&6)!==0)throw Error(ie(327));Hs();var e=oc(n,0);if((e&1)===0)return Tn(n,Rt()),null;var t=Ec(n,e);if(n.tag!==0&&t===2){var i=pd(n);i!==0&&(e=i,t=Hd(n,i))}if(t===1)throw t=Da,Zr(n,0),lr(n,e),Tn(n,Rt()),t;if(t===6)throw Error(ie(345));return n.finishedWork=n.current.alternate,n.finishedLanes=e,qr(n,Mn,Ci),Tn(n,Rt()),null}function bf(n,e){var t=et;et|=1;try{return n(e)}finally{et=t,et===0&&(Ks=Rt()+500,Ic&&wr())}}function ns(n){ur!==null&&ur.tag===0&&(et&6)===0&&Hs();var e=et;et|=1;var t=qn.transition,i=ot;try{if(qn.transition=null,ot=1,n)return n()}finally{ot=i,qn.transition=t,et=e,(et&6)===0&&wr()}}function Rf(){Pn=Os.current,pt(Os)}function Zr(n,e){n.finishedWork=null,n.finishedLanes=0;var t=n.timeoutHandle;if(t!==-1&&(n.timeoutHandle=-1,VS(t)),Lt!==null)for(t=Lt.return;t!==null;){var i=t;switch(lf(i),i.tag){case 1:i=i.type.childContextTypes,i!=null&&hc();break;case 3:Ys(),pt(wn),pt(sn),vf();break;case 5:gf(i);break;case 4:Ys();break;case 13:pt(xt);break;case 19:pt(xt);break;case 10:df(i.type._context);break;case 22:case 23:Rf()}t=t.return}if(Gt=n,Lt=n=yr(n.current,null),Zt=Pn=e,Ot=0,Da=null,Tf=Uc=ts=0,Mn=ga=null,jr!==null){for(e=0;e<jr.length;e++)if(t=jr[e],i=t.interleaved,i!==null){t.interleaved=null;var r=i.next,s=t.pending;if(s!==null){var o=s.next;s.next=r,i.next=o}t.pending=i}jr=null}return n}function uy(n,e){do{var t=Lt;try{if(hf(),Zl.current=xc,_c){for(var i=Mt.memoizedState;i!==null;){var r=i.queue;r!==null&&(r.pending=null),i=i.next}_c=!1}if(es=0,Ht=Ut=Mt=null,pa=!1,Ia=0,Ef.current=null,t===null||t.return===null){Ot=1,Da=e,Lt=null;break}e:{var s=n,o=t.return,a=t,l=e;if(e=Zt,a.flags|=32768,l!==null&&typeof l=="object"&&typeof l.then=="function"){var c=l,u=a,h=u.tag;if((u.mode&1)===0&&(h===0||h===11||h===15)){var d=u.alternate;d?(u.updateQueue=d.updateQueue,u.memoizedState=d.memoizedState,u.lanes=d.lanes):(u.updateQueue=null,u.memoizedState=null)}var p=r0(o);if(p!==null){p.flags&=-257,s0(p,o,a,s,e),p.mode&1&&i0(s,c,e),e=p,l=c;var v=e.updateQueue;if(v===null){var _=new Set;_.add(l),e.updateQueue=_}else v.add(l);break e}else{if((e&1)===0){i0(s,c,e),Cf();break e}l=Error(ie(426))}}else if(_t&&a.mode&1){var m=r0(o);if(m!==null){(m.flags&65536)===0&&(m.flags|=256),s0(m,o,a,s,e),cf(js(l,a));break e}}s=l=js(l,a),Ot!==4&&(Ot=2),ga===null?ga=[s]:ga.push(s),s=o;do{switch(s.tag){case 3:s.flags|=65536,e&=-e,s.lanes|=e;var f=Yv(s,l,e);Zg(s,f);break e;case 1:a=l;var g=s.type,y=s.stateNode;if((s.flags&128)===0&&(typeof g.getDerivedStateFromError=="function"||y!==null&&typeof y.componentDidCatch=="function"&&(gr===null||!gr.has(y)))){s.flags|=65536,e&=-e,s.lanes|=e;var x=jv(s,a,e);Zg(s,x);break e}}s=s.return}while(s!==null)}fy(t)}catch(R){e=R,Lt===t&&t!==null&&(Lt=t=t.return);continue}break}while(!0)}function hy(){var n=Mc.current;return Mc.current=xc,n===null?xc:n}function Cf(){(Ot===0||Ot===3||Ot===2)&&(Ot=4),Gt===null||(ts&268435455)===0&&(Uc&268435455)===0||lr(Gt,Zt)}function Ec(n,e){var t=et;et|=2;var i=hy();(Gt!==n||Zt!==e)&&(Ci=null,Zr(n,e));do try{d1();break}catch(r){uy(n,r)}while(!0);if(hf(),et=t,Mc.current=i,Lt!==null)throw Error(ie(261));return Gt=null,Zt=0,Ot}function d1(){for(;Lt!==null;)dy(Lt)}function f1(){for(;Lt!==null&&!BM();)dy(Lt)}function dy(n){var e=my(n.alternate,n,Pn);n.memoizedProps=n.pendingProps,e===null?fy(n):Lt=e,Ef.current=null}function fy(n){var e=n;do{var t=e.alternate;if(n=e.return,(e.flags&32768)===0){if(t=s1(t,e,Pn),t!==null){Lt=t;return}}else{if(t=o1(t,e),t!==null){t.flags&=32767,Lt=t;return}if(n!==null)n.flags|=32768,n.subtreeFlags=0,n.deletions=null;else{Ot=6,Lt=null;return}}if(e=e.sibling,e!==null){Lt=e;return}Lt=e=n}while(e!==null);Ot===0&&(Ot=5)}function qr(n,e,t){var i=ot,r=qn.transition;try{qn.transition=null,ot=1,p1(n,e,t,i)}finally{qn.transition=r,ot=i}return null}function p1(n,e,t,i){do Hs();while(ur!==null);if((et&6)!==0)throw Error(ie(327));t=n.finishedWork;var r=n.finishedLanes;if(t===null)return null;if(n.finishedWork=null,n.finishedLanes=0,t===n.current)throw Error(ie(177));n.callbackNode=null,n.callbackPriority=0;var s=t.lanes|t.childLanes;if(ZM(n,s),n===Gt&&(Lt=Gt=null,Zt=0),(t.subtreeFlags&2064)===0&&(t.flags&2064)===0||Xl||(Xl=!0,gy(sc,function(){return Hs(),null})),s=(t.flags&15990)!==0,(t.subtreeFlags&15990)!==0||s){s=qn.transition,qn.transition=null;var o=ot;ot=1;var a=et;et|=4,Ef.current=null,l1(n,t),ay(t,n),OS(xd),ac=!!_d,xd=_d=null,n.current=t,c1(t,n,r),VM(),et=a,ot=o,qn.transition=s}else n.current=t;if(Xl&&(Xl=!1,ur=n,wc=r),s=n.pendingLanes,s===0&&(gr=null),WM(t.stateNode,i),Tn(n,Rt()),e!==null)for(i=n.onRecoverableError,t=0;t<e.length;t++)r=e[t],i(r.value,{componentStack:r.stack,digest:r.digest});if(Sc)throw Sc=!1,n=Bd,Bd=null,n;return(wc&1)!==0&&n.tag!==0&&Hs(),s=n.pendingLanes,(s&1)!==0?n===Vd?va++:(va=0,Vd=n):va=0,wr(),null}function Hs(){if(ur!==null){var n=q0(wc),e=qn.transition,t=ot;try{if(qn.transition=null,ot=16>n?16:n,ur===null)var i=!1;else{if(n=ur,ur=null,wc=0,(et&6)!==0)throw Error(ie(331));var r=et;for(et|=4,ge=n.current;ge!==null;){var s=ge,o=s.child;if((ge.flags&16)!==0){var a=s.deletions;if(a!==null){for(var l=0;l<a.length;l++){var c=a[l];for(ge=c;ge!==null;){var u=ge;switch(u.tag){case 0:case 11:case 15:ma(8,u,s)}var h=u.child;if(h!==null)h.return=u,ge=h;else for(;ge!==null;){u=ge;var d=u.sibling,p=u.return;if(ry(u),u===c){ge=null;break}if(d!==null){d.return=p,ge=d;break}ge=p}}}var v=s.alternate;if(v!==null){var _=v.child;if(_!==null){v.child=null;do{var m=_.sibling;_.sibling=null,_=m}while(_!==null)}}ge=s}}if((s.subtreeFlags&2064)!==0&&o!==null)o.return=s,ge=o;else e:for(;ge!==null;){if(s=ge,(s.flags&2048)!==0)switch(s.tag){case 0:case 11:case 15:ma(9,s,s.return)}var f=s.sibling;if(f!==null){f.return=s.return,ge=f;break e}ge=s.return}}var g=n.current;for(ge=g;ge!==null;){o=ge;var y=o.child;if((o.subtreeFlags&2064)!==0&&y!==null)y.return=o,ge=y;else e:for(o=g;ge!==null;){if(a=ge,(a.flags&2048)!==0)try{switch(a.tag){case 0:case 11:case 15:Dc(9,a)}}catch(R){At(a,a.return,R)}if(a===o){ge=null;break e}var x=a.sibling;if(x!==null){x.return=a.return,ge=x;break e}ge=a.return}}if(et=r,wr(),yi&&typeof yi.onPostCommitFiberRoot=="function")try{yi.onPostCommitFiberRoot(Ac,n)}catch{}i=!0}return i}finally{ot=t,qn.transition=e}}return!1}function y0(n,e,t){e=js(t,e),e=Yv(n,e,1),n=mr(n,e,1),e=pn(),n!==null&&(Ua(n,1,e),Tn(n,e))}function At(n,e,t){if(n.tag===3)y0(n,n,t);else for(;e!==null;){if(e.tag===3){y0(e,n,t);break}else if(e.tag===1){var i=e.stateNode;if(typeof e.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(gr===null||!gr.has(i))){n=js(t,n),n=jv(e,n,1),e=mr(e,n,1),n=pn(),e!==null&&(Ua(e,1,n),Tn(e,n));break}}e=e.return}}function m1(n,e,t){var i=n.pingCache;i!==null&&i.delete(e),e=pn(),n.pingedLanes|=n.suspendedLanes&t,Gt===n&&(Zt&t)===t&&(Ot===4||Ot===3&&(Zt&130023424)===Zt&&500>Rt()-Af?Zr(n,0):Tf|=t),Tn(n,e)}function py(n,e){e===0&&((n.mode&1)===0?e=1:(e=Il,Il<<=1,(Il&130023424)===0&&(Il=4194304)));var t=pn();n=Oi(n,e),n!==null&&(Ua(n,e,t),Tn(n,t))}function g1(n){var e=n.memoizedState,t=0;e!==null&&(t=e.retryLane),py(n,t)}function v1(n,e){var t=0;switch(n.tag){case 13:var i=n.stateNode,r=n.memoizedState;r!==null&&(t=r.retryLane);break;case 19:i=n.stateNode;break;default:throw Error(ie(314))}i!==null&&i.delete(e),py(n,t)}var my;my=function(n,e,t){if(n!==null)if(n.memoizedProps!==e.pendingProps||wn.current)Sn=!0;else{if((n.lanes&t)===0&&(e.flags&128)===0)return Sn=!1,r1(n,e,t);Sn=(n.flags&131072)!==0}else Sn=!1,_t&&(e.flags&1048576)!==0&&yv(e,pc,e.index);switch(e.lanes=0,e.tag){case 2:var i=e.type;Jl(n,e),n=e.pendingProps;var r=Ws(e,sn.current);Vs(e,t),r=_f(null,e,i,n,r,t);var s=xf();return e.flags|=1,typeof r=="object"&&r!==null&&typeof r.render=="function"&&r.$$typeof===void 0?(e.tag=1,e.memoizedState=null,e.updateQueue=null,En(i)?(s=!0,dc(e)):s=!1,e.memoizedState=r.state!==null&&r.state!==void 0?r.state:null,pf(e),r.updater=Lc,e.stateNode=r,r._reactInternals=e,Cd(e,i,n,t),e=Ld(null,e,i,!0,s,t)):(e.tag=0,_t&&s&&af(e),fn(null,e,r,t),e=e.child),e;case 16:i=e.elementType;e:{switch(Jl(n,e),n=e.pendingProps,r=i._init,i=r(i._payload),e.type=i,r=e.tag=_1(i),n=ti(i,n),r){case 0:e=Id(null,e,i,n,t);break e;case 1:e=l0(null,e,i,n,t);break e;case 11:e=o0(null,e,i,n,t);break e;case 14:e=a0(null,e,i,ti(i.type,n),t);break e}throw Error(ie(306,i,""))}return e;case 0:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:ti(i,r),Id(n,e,i,r,t);case 1:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:ti(i,r),l0(n,e,i,r,t);case 3:e:{if(Jv(e),n===null)throw Error(ie(387));i=e.pendingProps,s=e.memoizedState,r=s.element,Sv(n,e),vc(e,i,null,t);var o=e.memoizedState;if(i=o.element,s.isDehydrated)if(s={element:i,isDehydrated:!1,cache:o.cache,pendingSuspenseBoundaries:o.pendingSuspenseBoundaries,transitions:o.transitions},e.updateQueue.baseState=s,e.memoizedState=s,e.flags&256){r=js(Error(ie(423)),e),e=c0(n,e,i,t,r);break e}else if(i!==r){r=js(Error(ie(424)),e),e=c0(n,e,i,t,r);break e}else for(In=pr(e.stateNode.containerInfo.firstChild),Ln=e,_t=!0,ii=null,t=Av(e,null,i,t),e.child=t;t;)t.flags=t.flags&-3|4096,t=t.sibling;else{if(Xs(),i===r){e=Fi(n,e,t);break e}fn(n,e,i,t)}e=e.child}return e;case 5:return bv(e),n===null&&Ad(e),i=e.type,r=e.pendingProps,s=n!==null?n.memoizedProps:null,o=r.children,Md(i,r)?o=null:s!==null&&Md(i,s)&&(e.flags|=32),$v(n,e),fn(n,e,o,t),e.child;case 6:return n===null&&Ad(e),null;case 13:return Qv(n,e,t);case 4:return mf(e,e.stateNode.containerInfo),i=e.pendingProps,n===null?e.child=qs(e,null,i,t):fn(n,e,i,t),e.child;case 11:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:ti(i,r),o0(n,e,i,r,t);case 7:return fn(n,e,e.pendingProps,t),e.child;case 8:return fn(n,e,e.pendingProps.children,t),e.child;case 12:return fn(n,e,e.pendingProps.children,t),e.child;case 10:e:{if(i=e.type._context,r=e.pendingProps,s=e.memoizedProps,o=r.value,dt(mc,i._currentValue),i._currentValue=o,s!==null)if(oi(s.value,o)){if(s.children===r.children&&!wn.current){e=Fi(n,e,t);break e}}else for(s=e.child,s!==null&&(s.return=e);s!==null;){var a=s.dependencies;if(a!==null){o=s.child;for(var l=a.firstContext;l!==null;){if(l.context===i){if(s.tag===1){l=Ni(-1,t&-t),l.tag=2;var c=s.updateQueue;if(c!==null){c=c.shared;var u=c.pending;u===null?l.next=l:(l.next=u.next,u.next=l),c.pending=l}}s.lanes|=t,l=s.alternate,l!==null&&(l.lanes|=t),bd(s.return,t,e),a.lanes|=t;break}l=l.next}}else if(s.tag===10)o=s.type===e.type?null:s.child;else if(s.tag===18){if(o=s.return,o===null)throw Error(ie(341));o.lanes|=t,a=o.alternate,a!==null&&(a.lanes|=t),bd(o,t,e),o=s.sibling}else o=s.child;if(o!==null)o.return=s;else for(o=s;o!==null;){if(o===e){o=null;break}if(s=o.sibling,s!==null){s.return=o.return,o=s;break}o=o.return}s=o}fn(n,e,r.children,t),e=e.child}return e;case 9:return r=e.type,i=e.pendingProps.children,Vs(e,t),r=Yn(r),i=i(r),e.flags|=1,fn(n,e,i,t),e.child;case 14:return i=e.type,r=ti(i,e.pendingProps),r=ti(i.type,r),a0(n,e,i,r,t);case 15:return Kv(n,e,e.type,e.pendingProps,t);case 17:return i=e.type,r=e.pendingProps,r=e.elementType===i?r:ti(i,r),Jl(n,e),e.tag=1,En(i)?(n=!0,dc(e)):n=!1,Vs(e,t),Ev(e,i,r),Cd(e,i,r,t),Ld(null,e,i,!0,n,t);case 19:return ey(n,e,t);case 22:return Zv(n,e,t)}throw Error(ie(156,e.tag))};function gy(n,e){return H0(n,e)}function y1(n,e,t,i){this.tag=n,this.key=t,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=e,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Xn(n,e,t,i){return new y1(n,e,t,i)}function Pf(n){return n=n.prototype,!(!n||!n.isReactComponent)}function _1(n){if(typeof n=="function")return Pf(n)?1:0;if(n!=null){if(n=n.$$typeof,n===jd)return 11;if(n===Kd)return 14}return 2}function yr(n,e){var t=n.alternate;return t===null?(t=Xn(n.tag,e,n.key,n.mode),t.elementType=n.elementType,t.type=n.type,t.stateNode=n.stateNode,t.alternate=n,n.alternate=t):(t.pendingProps=e,t.type=n.type,t.flags=0,t.subtreeFlags=0,t.deletions=null),t.flags=n.flags&14680064,t.childLanes=n.childLanes,t.lanes=n.lanes,t.child=n.child,t.memoizedProps=n.memoizedProps,t.memoizedState=n.memoizedState,t.updateQueue=n.updateQueue,e=n.dependencies,t.dependencies=e===null?null:{lanes:e.lanes,firstContext:e.firstContext},t.sibling=n.sibling,t.index=n.index,t.ref=n.ref,t}function tc(n,e,t,i,r,s){var o=2;if(i=n,typeof n=="function")Pf(n)&&(o=1);else if(typeof n=="string")o=5;else e:switch(n){case As:return $r(t.children,r,s,e);case Yd:o=8,r|=8;break;case Qh:return n=Xn(12,t,e,r|2),n.elementType=Qh,n.lanes=s,n;case ed:return n=Xn(13,t,e,r),n.elementType=ed,n.lanes=s,n;case td:return n=Xn(19,t,e,r),n.elementType=td,n.lanes=s,n;case T0:return Oc(t,r,s,e);default:if(typeof n=="object"&&n!==null)switch(n.$$typeof){case w0:o=10;break e;case E0:o=9;break e;case jd:o=11;break e;case Kd:o=14;break e;case sr:o=16,i=null;break e}throw Error(ie(130,n==null?n:typeof n,""))}return e=Xn(o,t,e,r),e.elementType=n,e.type=i,e.lanes=s,e}function $r(n,e,t,i){return n=Xn(7,n,i,e),n.lanes=t,n}function Oc(n,e,t,i){return n=Xn(22,n,i,e),n.elementType=T0,n.lanes=t,n.stateNode={isHidden:!1},n}function Zh(n,e,t){return n=Xn(6,n,null,e),n.lanes=t,n}function $h(n,e,t){return e=Xn(4,n.children!==null?n.children:[],n.key,e),e.lanes=t,e.stateNode={containerInfo:n.containerInfo,pendingChildren:null,implementation:n.implementation},e}function x1(n,e,t,i,r){this.tag=e,this.containerInfo=n,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=Dh(0),this.expirationTimes=Dh(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Dh(0),this.identifierPrefix=i,this.onRecoverableError=r,this.mutableSourceEagerHydrationData=null}function If(n,e,t,i,r,s,o,a,l){return n=new x1(n,e,t,a,l),e===1?(e=1,s===!0&&(e|=8)):e=0,s=Xn(3,null,null,e),n.current=s,s.stateNode=n,s.memoizedState={element:i,isDehydrated:t,cache:null,transitions:null,pendingSuspenseBoundaries:null},pf(s),n}function M1(n,e,t){var i=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:Ts,key:i==null?null:""+i,children:n,containerInfo:e,implementation:t}}function vy(n){if(!n)return xr;n=n._reactInternals;e:{if(rs(n)!==n||n.tag!==1)throw Error(ie(170));var e=n;do{switch(e.tag){case 3:e=e.stateNode.context;break e;case 1:if(En(e.type)){e=e.stateNode.__reactInternalMemoizedMergedChildContext;break e}}e=e.return}while(e!==null);throw Error(ie(171))}if(n.tag===1){var t=n.type;if(En(t))return gv(n,t,e)}return e}function yy(n,e,t,i,r,s,o,a,l){return n=If(t,i,!0,n,r,s,o,a,l),n.context=vy(null),t=n.current,i=pn(),r=vr(t),s=Ni(i,r),s.callback=e??null,mr(t,s,r),n.current.lanes=r,Ua(n,r,i),Tn(n,i),n}function Fc(n,e,t,i){var r=e.current,s=pn(),o=vr(r);return t=vy(t),e.context===null?e.context=t:e.pendingContext=t,e=Ni(s,o),e.payload={element:n},i=i===void 0?null:i,i!==null&&(e.callback=i),n=mr(r,e,o),n!==null&&(si(n,r,o,s),Kl(n,r,o)),o}function Tc(n){return n=n.current,n.child?(n.child.tag===5,n.child.stateNode):null}function _0(n,e){if(n=n.memoizedState,n!==null&&n.dehydrated!==null){var t=n.retryLane;n.retryLane=t!==0&&t<e?t:e}}function Lf(n,e){_0(n,e),(n=n.alternate)&&_0(n,e)}function S1(){return null}var _y=typeof reportError=="function"?reportError:function(n){console.error(n)};function Nf(n){this._internalRoot=n}kc.prototype.render=Nf.prototype.render=function(n){var e=this._internalRoot;if(e===null)throw Error(ie(409));Fc(n,e,null,null)};kc.prototype.unmount=Nf.prototype.unmount=function(){var n=this._internalRoot;if(n!==null){this._internalRoot=null;var e=n.containerInfo;ns(function(){Fc(null,n,null,null)}),e[Ui]=null}};function kc(n){this._internalRoot=n}kc.prototype.unstable_scheduleHydration=function(n){if(n){var e=K0();n={blockedOn:null,target:n,priority:e};for(var t=0;t<ar.length&&e!==0&&e<ar[t].priority;t++);ar.splice(t,0,n),t===0&&$0(n)}};function Df(n){return!(!n||n.nodeType!==1&&n.nodeType!==9&&n.nodeType!==11)}function zc(n){return!(!n||n.nodeType!==1&&n.nodeType!==9&&n.nodeType!==11&&(n.nodeType!==8||n.nodeValue!==" react-mount-point-unstable "))}function x0(){}function w1(n,e,t,i,r){if(r){if(typeof i=="function"){var s=i;i=function(){var c=Tc(o);s.call(c)}}var o=yy(e,i,n,0,null,!1,!1,"",x0);return n._reactRootContainer=o,n[Ui]=o.current,Aa(n.nodeType===8?n.parentNode:n),ns(),o}for(;r=n.lastChild;)n.removeChild(r);if(typeof i=="function"){var a=i;i=function(){var c=Tc(l);a.call(c)}}var l=If(n,0,!1,null,null,!1,!1,"",x0);return n._reactRootContainer=l,n[Ui]=l.current,Aa(n.nodeType===8?n.parentNode:n),ns(function(){Fc(e,l,t,i)}),l}function Bc(n,e,t,i,r){var s=t._reactRootContainer;if(s){var o=s;if(typeof r=="function"){var a=r;r=function(){var l=Tc(o);a.call(l)}}Fc(e,o,n,r)}else o=w1(t,e,n,r,i);return Tc(o)}Y0=function(n){switch(n.tag){case 3:var e=n.stateNode;if(e.current.memoizedState.isDehydrated){var t=aa(e.pendingLanes);t!==0&&(Jd(e,t|1),Tn(e,Rt()),(et&6)===0&&(Ks=Rt()+500,wr()))}break;case 13:ns(function(){var i=Oi(n,1);if(i!==null){var r=pn();si(i,n,1,r)}}),Lf(n,1)}};Qd=function(n){if(n.tag===13){var e=Oi(n,134217728);if(e!==null){var t=pn();si(e,n,134217728,t)}Lf(n,134217728)}};j0=function(n){if(n.tag===13){var e=vr(n),t=Oi(n,e);if(t!==null){var i=pn();si(t,n,e,i)}Lf(n,e)}};K0=function(){return ot};Z0=function(n,e){var t=ot;try{return ot=n,e()}finally{ot=t}};hd=function(n,e,t){switch(e){case"input":if(rd(n,t),e=t.name,t.type==="radio"&&e!=null){for(t=n;t.parentNode;)t=t.parentNode;for(t=t.querySelectorAll("input[name="+JSON.stringify(""+e)+'][type="radio"]'),e=0;e<t.length;e++){var i=t[e];if(i!==n&&i.form===n.form){var r=Pc(i);if(!r)throw Error(ie(90));b0(i),rd(i,r)}}}break;case"textarea":C0(n,t);break;case"select":e=t.value,e!=null&&Fs(n,!!t.multiple,e,!1)}};O0=bf;F0=ns;var E1={usingClientEntryPoint:!1,Events:[Fa,Ps,Pc,D0,U0,bf]},ia={findFiberByHostInstance:Yr,bundleType:0,version:"18.2.0",rendererPackageName:"react-dom"},T1={bundleType:ia.bundleType,version:ia.version,rendererPackageName:ia.rendererPackageName,rendererConfig:ia.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:ki.ReactCurrentDispatcher,findHostInstanceByFiber:function(n){return n=B0(n),n===null?null:n.stateNode},findFiberByHostInstance:ia.findFiberByHostInstance||S1,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.2.0-next-9e3b772b8-20220608"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&(ra=__REACT_DEVTOOLS_GLOBAL_HOOK__,!ra.isDisabled&&ra.supportsFiber))try{Ac=ra.inject(T1),yi=ra}catch{}var ra;Un.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=E1;Un.createPortal=function(n,e){var t=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!Df(e))throw Error(ie(200));return M1(n,e,null,t)};Un.createRoot=function(n,e){if(!Df(n))throw Error(ie(299));var t=!1,i="",r=_y;return e!=null&&(e.unstable_strictMode===!0&&(t=!0),e.identifierPrefix!==void 0&&(i=e.identifierPrefix),e.onRecoverableError!==void 0&&(r=e.onRecoverableError)),e=If(n,1,!1,null,null,t,!1,i,r),n[Ui]=e.current,Aa(n.nodeType===8?n.parentNode:n),new Nf(e)};Un.findDOMNode=function(n){if(n==null)return null;if(n.nodeType===1)return n;var e=n._reactInternals;if(e===void 0)throw typeof n.render=="function"?Error(ie(188)):(n=Object.keys(n).join(","),Error(ie(268,n)));return n=B0(e),n=n===null?null:n.stateNode,n};Un.flushSync=function(n){return ns(n)};Un.hydrate=function(n,e,t){if(!zc(e))throw Error(ie(200));return Bc(null,n,e,!0,t)};Un.hydrateRoot=function(n,e,t){if(!Df(n))throw Error(ie(405));var i=t!=null&&t.hydratedSources||null,r=!1,s="",o=_y;if(t!=null&&(t.unstable_strictMode===!0&&(r=!0),t.identifierPrefix!==void 0&&(s=t.identifierPrefix),t.onRecoverableError!==void 0&&(o=t.onRecoverableError)),e=yy(e,null,n,1,t??null,r,!1,s,o),n[Ui]=e.current,Aa(n),i)for(n=0;n<i.length;n++)t=i[n],r=t._getVersion,r=r(t._source),e.mutableSourceEagerHydrationData==null?e.mutableSourceEagerHydrationData=[t,r]:e.mutableSourceEagerHydrationData.push(t,r);return new kc(e)};Un.render=function(n,e,t){if(!zc(e))throw Error(ie(200));return Bc(null,n,e,!1,t)};Un.unmountComponentAtNode=function(n){if(!zc(n))throw Error(ie(40));return n._reactRootContainer?(ns(function(){Bc(null,null,n,!1,function(){n._reactRootContainer=null,n[Ui]=null})}),!0):!1};Un.unstable_batchedUpdates=bf;Un.unstable_renderSubtreeIntoContainer=function(n,e,t,i){if(!zc(t))throw Error(ie(200));if(n==null||n._reactInternals===void 0)throw Error(ie(38));return Bc(n,e,t,!1,i)};Un.version="18.2.0-next-9e3b772b8-20220608"});var wy=Ri((NC,Sy)=>{"use strict";function My(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(My)}catch(n){console.error(n)}}My(),Sy.exports=xy()});var Ty=Ri(Uf=>{"use strict";var Ey=wy();Uf.createRoot=Ey.createRoot,Uf.hydrateRoot=Ey.hydrateRoot;var DC});var Kx=Ri(ch=>{"use strict";var _C=Ml(),xC=Symbol.for("react.element"),MC=Symbol.for("react.fragment"),SC=Object.prototype.hasOwnProperty,wC=_C.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,EC={key:!0,ref:!0,__self:!0,__source:!0};function jx(n,e,t){var i,r={},s=null,o=null;t!==void 0&&(s=""+t),e.key!==void 0&&(s=""+e.key),e.ref!==void 0&&(o=e.ref);for(i in e)SC.call(e,i)&&!EC.hasOwnProperty(i)&&(r[i]=e[i]);if(n&&n.defaultProps)for(i in e=n.defaultProps,e)r[i]===void 0&&(r[i]=e[i]);return{$$typeof:xC,type:n,key:s,ref:o,props:r,_owner:wC.current}}ch.Fragment=MC;ch.jsx=jx;ch.jsxs=jx});var vl=Ri((r2,Zx)=>{"use strict";Zx.exports=Kx()});var Qe=Ms(Ml(),1),Jx=Ms(Ty(),1);var A1=0,Ay=1,b1=2;var dx=1,hl=2,Xi=3,Zn=0,Xt=1,yn=2,Lr=0,So=1,by=2,Ry=3,Cy=4,R1=5,ds=100,C1=101,P1=102,I1=103,L1=104,N1=200,D1=201,U1=202,O1=203,vp=204,yp=205,F1=206,k1=207,z1=208,B1=209,V1=210,H1=211,G1=212,W1=213,X1=214,q1=0,Y1=1,j1=2,mu=3,K1=4,Z1=5,$1=6,J1=7,fx=0,Q1=1,ew=2,wi=0,tw=1,nw=2,iw=3,Qp=4,rw=5,sw=6,ow=7,Py="attached",aw="detached",px=300,Ao=301,bo=302,_p=303,xp=304,Ku=306,ps=1e3,Yi=1001,Ja=1002,cn=1003,em=1004;var vo=1005;var An=1006,ja=1007;var Mi=1008;var Nr=1009,lw=1010,cw=1011,mx=1012,gx=1013,Ro=1014,Si=1015,Zu=1016,vx=1017,yx=1018,dl=1020,uw=35902,hw=1021,dw=1022,hi=1023,fw=1024,pw=1025,wo=1026,Qa=1027,_x=1028,xx=1029,mw=1030,Mx=1031,Sx=1033,Of=33776,Ff=33777,kf=33778,zf=33779,Iy=35840,Ly=35841,Ny=35842,Dy=35843,Uy=36196,Oy=37492,Fy=37496,ky=37808,zy=37809,By=37810,Vy=37811,Hy=37812,Gy=37813,Wy=37814,Xy=37815,qy=37816,Yy=37817,jy=37818,Ky=37819,Zy=37820,$y=37821,Bf=36492,Jy=36494,Qy=36495,gw=36283,e_=36284,t_=36285,n_=36286,vw=2200,yw=2201,_w=2202,Co=2300,ms=2301,Vf=2302,yo=2400,_o=2401,gu=2402,tm=2500,xw=2501,wx=0,$u=1,fl=2,Mw=3200,Sw=3201,Ex=0,ww=1,Pr="",wt="srgb",jt="srgb-linear",nm="display-p3",Ju="display-p3-linear",vu="linear",mt="srgb",yu="rec709",_u="p3";var Js=7680;var i_=519,Ew=512,Tw=513,Aw=514,Tx=515,bw=516,Rw=517,Cw=518,Pw=519,Mp=35044;var r_="300 es",ji=2e3,xu=2001,Ki=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let i=this._listeners;return i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let r=this._listeners[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let i=this._listeners[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},on=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],s_=1234567,Ka=Math.PI/180,Po=180/Math.PI;function di(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(on[n&255]+on[n>>8&255]+on[n>>16&255]+on[n>>24&255]+"-"+on[e&255]+on[e>>8&255]+"-"+on[e>>16&15|64]+on[e>>24&255]+"-"+on[t&63|128]+on[t>>8&255]+"-"+on[t>>16&255]+on[t>>24&255]+on[i&255]+on[i>>8&255]+on[i>>16&255]+on[i>>24&255]).toLowerCase()}function ln(n,e,t){return Math.max(e,Math.min(t,n))}function im(n,e){return(n%e+e)%e}function Iw(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function Lw(n,e,t){return n!==e?(t-n)/(e-n):0}function Za(n,e,t){return(1-t)*n+t*e}function Nw(n,e,t,i){return Za(n,e,1-Math.exp(-t*i))}function Dw(n,e=1){return e-Math.abs(im(n,e*2)-e)}function Uw(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function Ow(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function Fw(n,e){return n+Math.floor(Math.random()*(e-n+1))}function kw(n,e){return n+Math.random()*(e-n)}function zw(n){return n*(.5-Math.random())}function Bw(n){n!==void 0&&(s_=n);let e=s_+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Vw(n){return n*Ka}function Hw(n){return n*Po}function Gw(n){return(n&n-1)===0&&n!==0}function Ww(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function Xw(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function qw(n,e,t,i,r){let s=Math.cos,o=Math.sin,a=s(t/2),l=o(t/2),c=s((e+i)/2),u=o((e+i)/2),h=s((e-i)/2),d=o((e-i)/2),p=s((i-e)/2),v=o((i-e)/2);switch(r){case"XYX":n.set(a*u,l*h,l*d,a*c);break;case"YZY":n.set(l*d,a*u,l*h,a*c);break;case"ZXZ":n.set(l*h,l*d,a*u,a*c);break;case"XZX":n.set(a*u,l*v,l*p,a*c);break;case"YXY":n.set(l*p,a*u,l*v,a*c);break;case"ZYZ":n.set(l*v,l*p,a*u,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function ui(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function at(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}var pl={DEG2RAD:Ka,RAD2DEG:Po,generateUUID:di,clamp:ln,euclideanModulo:im,mapLinear:Iw,inverseLerp:Lw,lerp:Za,damp:Nw,pingpong:Dw,smoothstep:Uw,smootherstep:Ow,randInt:Fw,randFloat:kw,randFloatSpread:zw,seededRandom:Bw,degToRad:Vw,radToDeg:Hw,isPowerOfTwo:Gw,ceilPowerOfTwo:Ww,floorPowerOfTwo:Xw,setQuaternionFromProperEuler:qw,normalize:at,denormalize:ui},Le=class n{constructor(e=0,t=0){n.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(ln(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Ge=class n{constructor(e,t,i,r,s,o,a,l,c){n.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c)}set(e,t,i,r,s,o,a,l,c){let u=this.elements;return u[0]=e,u[1]=r,u[2]=a,u[3]=t,u[4]=s,u[5]=l,u[6]=i,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],u=i[4],h=i[7],d=i[2],p=i[5],v=i[8],_=r[0],m=r[3],f=r[6],g=r[1],y=r[4],x=r[7],R=r[2],T=r[5],b=r[8];return s[0]=o*_+a*g+l*R,s[3]=o*m+a*y+l*T,s[6]=o*f+a*x+l*b,s[1]=c*_+u*g+h*R,s[4]=c*m+u*y+h*T,s[7]=c*f+u*x+h*b,s[2]=d*_+p*g+v*R,s[5]=d*m+p*y+v*T,s[8]=d*f+p*x+v*b,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8];return t*o*u-t*a*c-i*s*u+i*a*l+r*s*c-r*o*l}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=u*o-a*c,d=a*l-u*s,p=c*s-o*l,v=t*h+i*d+r*p;if(v===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/v;return e[0]=h*_,e[1]=(r*c-u*i)*_,e[2]=(a*i-r*o)*_,e[3]=d*_,e[4]=(u*t-r*l)*_,e[5]=(r*s-a*t)*_,e[6]=p*_,e[7]=(i*l-c*t)*_,e[8]=(o*t-i*s)*_,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){let l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-r*c,r*l,-r*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(Hf.makeScale(e,t)),this}rotate(e){return this.premultiply(Hf.makeRotation(-e)),this}translate(e,t){return this.premultiply(Hf.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Hf=new Ge;function Ax(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function el(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Yw(){let n=el("canvas");return n.style.display="block",n}var o_={};function bx(n){n in o_||(o_[n]=!0,console.warn(n))}var a_=new Ge().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),l_=new Ge().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),Vc={[jt]:{transfer:vu,primaries:yu,toReference:n=>n,fromReference:n=>n},[wt]:{transfer:mt,primaries:yu,toReference:n=>n.convertSRGBToLinear(),fromReference:n=>n.convertLinearToSRGB()},[Ju]:{transfer:vu,primaries:_u,toReference:n=>n.applyMatrix3(l_),fromReference:n=>n.applyMatrix3(a_)},[nm]:{transfer:mt,primaries:_u,toReference:n=>n.convertSRGBToLinear().applyMatrix3(l_),fromReference:n=>n.applyMatrix3(a_).convertLinearToSRGB()}},jw=new Set([jt,Ju]),nt={enabled:!0,_workingColorSpace:jt,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(n){if(!jw.has(n))throw new Error(`Unsupported working color space, "${n}".`);this._workingColorSpace=n},convert:function(n,e,t){if(this.enabled===!1||e===t||!e||!t)return n;let i=Vc[e].toReference,r=Vc[t].fromReference;return r(i(n))},fromWorkingColorSpace:function(n,e){return this.convert(n,this._workingColorSpace,e)},toWorkingColorSpace:function(n,e){return this.convert(n,e,this._workingColorSpace)},getPrimaries:function(n){return Vc[n].primaries},getTransfer:function(n){return n===Pr?vu:Vc[n].transfer}};function Eo(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Gf(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var Qs,Sp=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Qs===void 0&&(Qs=el("canvas")),Qs.width=e.width,Qs.height=e.height;let i=Qs.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),t=Qs}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=el("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Eo(s[o]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Eo(t[i]/255)*255):t[i]=Eo(t[i]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Kw=0,Mu=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Kw++}),this.uuid=di(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(Wf(r[o].image)):s.push(Wf(r[o]))}else s=Wf(r);i.url=s}return t||(e.images[this.uuid]=i),i}};function Wf(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Sp.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var Zw=0,Dt=class n extends Ki{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=Yi,r=Yi,s=An,o=Mi,a=hi,l=Nr,c=n.DEFAULT_ANISOTROPY,u=Pr){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Zw++}),this.uuid=di(),this.name="",this.source=new Mu(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Le(0,0),this.repeat=new Le(1,1),this.center=new Le(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ge,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==px)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ps:e.x=e.x-Math.floor(e.x);break;case Yi:e.x=e.x<0?0:1;break;case Ja:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ps:e.y=e.y-Math.floor(e.y);break;case Yi:e.y=e.y<0?0:1;break;case Ja:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Dt.DEFAULT_IMAGE=null;Dt.DEFAULT_MAPPING=px;Dt.DEFAULT_ANISOTROPY=1;var ct=class n{constructor(e=0,t=0,i=0,r=1){n.prototype.isVector4=!0,this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s,l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],p=l[5],v=l[9],_=l[2],m=l[6],f=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-_)<.01&&Math.abs(v-m)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+_)<.1&&Math.abs(v+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let y=(c+1)/2,x=(p+1)/2,R=(f+1)/2,T=(u+d)/4,b=(h+_)/4,C=(v+m)/4;return y>x&&y>R?y<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(y),r=T/i,s=b/i):x>R?x<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(x),i=T/r,s=C/r):R<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(R),i=b/s,r=C/s),this.set(i,r,s,t),this}let g=Math.sqrt((m-v)*(m-v)+(h-_)*(h-_)+(d-u)*(d-u));return Math.abs(g)<.001&&(g=1),this.x=(m-v)/g,this.y=(h-_)/g,this.z=(d-u)/g,this.w=Math.acos((c+p+f-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},wp=class extends Ki{constructor(e=1,t=1,i={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new ct(0,0,e,t),this.scissorTest=!1,this.viewport=new ct(0,0,e,t);let r={width:e,height:t,depth:1};i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:An,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},i);let s=new Dt(r,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.colorSpace);s.flipY=!1,s.generateMipmaps=i.generateMipmaps,s.internalFormat=i.internalFormat,this.textures=[];let o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.depthTexture=i.depthTexture,this.samples=i.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let i=0,r=e.textures.length;i<r;i++)this.textures[i]=e.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0;let t=Object.assign({},e.texture.image);return this.texture.source=new Mu(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},Zi=class extends wp{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},Su=class extends Dt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=cn,this.minFilter=cn,this.wrapR=Yi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ep=class extends Dt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=cn,this.minFilter=cn,this.wrapR=Yi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var bn=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,o,a){let l=i[r+0],c=i[r+1],u=i[r+2],h=i[r+3],d=s[o+0],p=s[o+1],v=s[o+2],_=s[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h;return}if(a===1){e[t+0]=d,e[t+1]=p,e[t+2]=v,e[t+3]=_;return}if(h!==_||l!==d||c!==p||u!==v){let m=1-a,f=l*d+c*p+u*v+h*_,g=f>=0?1:-1,y=1-f*f;if(y>Number.EPSILON){let R=Math.sqrt(y),T=Math.atan2(R,f*g);m=Math.sin(m*T)/R,a=Math.sin(a*T)/R}let x=a*g;if(l=l*m+d*x,c=c*m+p*x,u=u*m+v*x,h=h*m+_*x,m===1-a){let R=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=R,c*=R,u*=R,h*=R}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,i,r,s,o){let a=i[r],l=i[r+1],c=i[r+2],u=i[r+3],h=s[o],d=s[o+1],p=s[o+2],v=s[o+3];return e[t]=a*v+u*h+l*p-c*d,e[t+1]=l*v+u*d+c*h-a*p,e[t+2]=c*v+u*p+a*d-l*h,e[t+3]=u*v-a*h-l*d-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),u=a(r/2),h=a(s/2),d=l(i/2),p=l(r/2),v=l(s/2);switch(o){case"XYZ":this._x=d*u*h+c*p*v,this._y=c*p*h-d*u*v,this._z=c*u*v+d*p*h,this._w=c*u*h-d*p*v;break;case"YXZ":this._x=d*u*h+c*p*v,this._y=c*p*h-d*u*v,this._z=c*u*v-d*p*h,this._w=c*u*h+d*p*v;break;case"ZXY":this._x=d*u*h-c*p*v,this._y=c*p*h+d*u*v,this._z=c*u*v+d*p*h,this._w=c*u*h-d*p*v;break;case"ZYX":this._x=d*u*h-c*p*v,this._y=c*p*h+d*u*v,this._z=c*u*v-d*p*h,this._w=c*u*h+d*p*v;break;case"YZX":this._x=d*u*h+c*p*v,this._y=c*p*h+d*u*v,this._z=c*u*v-d*p*h,this._w=c*u*h-d*p*v;break;case"XZY":this._x=d*u*h-c*p*v,this._y=c*p*h-d*u*v,this._z=c*u*v+d*p*h,this._w=c*u*h+d*p*v;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=i+a+h;if(d>0){let p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(u-l)*p,this._y=(s-c)*p,this._z=(o-r)*p}else if(i>a&&i>h){let p=2*Math.sqrt(1+i-a-h);this._w=(u-l)/p,this._x=.25*p,this._y=(r+o)/p,this._z=(s+c)/p}else if(a>h){let p=2*Math.sqrt(1+a-i-h);this._w=(s-c)/p,this._x=(r+o)/p,this._y=.25*p,this._z=(l+u)/p}else{let p=2*Math.sqrt(1+h-i-a);this._w=(o-r)/p,this._x=(s+c)/p,this._y=(l+u)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<Number.EPSILON?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(ln(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,l=t._y,c=t._z,u=t._w;return this._x=i*u+o*a+r*c-s*l,this._y=r*u+o*l+s*a-i*c,this._z=s*u+o*c+i*l-r*a,this._w=o*u-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let i=this._x,r=this._y,s=this._z,o=this._w,a=o*e._w+i*e._x+r*e._y+s*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=i,this._y=r,this._z=s,this;let l=1-a*a;if(l<=Number.EPSILON){let p=1-t;return this._w=p*o+t*this._w,this._x=p*i+t*this._x,this._y=p*r+t*this._y,this._z=p*s+t*this._z,this.normalize(),this}let c=Math.sqrt(l),u=Math.atan2(c,a),h=Math.sin((1-t)*u)/c,d=Math.sin(t*u)/c;return this._w=o*h+this._w*d,this._x=i*h+this._x*d,this._y=r*h+this._y*d,this._z=s*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},P=class n{constructor(e=0,t=0,i=0){n.prototype.isVector3=!0,this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(c_.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(c_.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){let t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*r-a*i),u=2*(a*t-s*r),h=2*(s*i-o*t);return this.x=t+l*c+o*h-a*u,this.y=i+l*u+a*c-s*h,this.z=r+l*h+s*u-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Xf.copy(this).projectOnVector(e),this.sub(Xf)}reflect(e){return this.sub(Xf.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(ln(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Xf=new P,c_=new bn,Rn=class{constructor(e=new P(1/0,1/0,1/0),t=new P(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(ai.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(ai.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=ai.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,ai):ai.fromBufferAttribute(s,o),ai.applyMatrix4(e.matrixWorld),this.expandByPoint(ai);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Hc.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),Hc.copy(i.boundingBox)),Hc.applyMatrix4(e.matrixWorld),this.union(Hc)}let r=e.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,ai),ai.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(za),Gc.subVectors(this.max,za),eo.subVectors(e.a,za),to.subVectors(e.b,za),no.subVectors(e.c,za),Er.subVectors(to,eo),Tr.subVectors(no,to),ss.subVectors(eo,no);let t=[0,-Er.z,Er.y,0,-Tr.z,Tr.y,0,-ss.z,ss.y,Er.z,0,-Er.x,Tr.z,0,-Tr.x,ss.z,0,-ss.x,-Er.y,Er.x,0,-Tr.y,Tr.x,0,-ss.y,ss.x,0];return!qf(t,eo,to,no,Gc)||(t=[1,0,0,0,1,0,0,0,1],!qf(t,eo,to,no,Gc))?!1:(Wc.crossVectors(Er,Tr),t=[Wc.x,Wc.y,Wc.z],qf(t,eo,to,no,Gc))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,ai).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(ai).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(zi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),zi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),zi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),zi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),zi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),zi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),zi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),zi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(zi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}},zi=[new P,new P,new P,new P,new P,new P,new P,new P],ai=new P,Hc=new Rn,eo=new P,to=new P,no=new P,Er=new P,Tr=new P,ss=new P,za=new P,Gc=new P,Wc=new P,os=new P;function qf(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){os.fromArray(n,s);let a=r.x*Math.abs(os.x)+r.y*Math.abs(os.y)+r.z*Math.abs(os.z),l=e.dot(os),c=t.dot(os),u=i.dot(os);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}var $w=new Rn,Ba=new P,Yf=new P,kn=class{constructor(e=new P,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):$w.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ba.subVectors(e,this.center);let t=Ba.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(Ba,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Yf.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ba.copy(e.center).add(Yf)),this.expandByPoint(Ba.copy(e.center).sub(Yf))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}},Bi=new P,jf=new P,Xc=new P,Ar=new P,Kf=new P,qc=new P,Zf=new P,$i=class{constructor(e=new P,t=new P(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Bi)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Bi.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Bi.copy(this.origin).addScaledVector(this.direction,t),Bi.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){jf.copy(e).add(t).multiplyScalar(.5),Xc.copy(t).sub(e).normalize(),Ar.copy(this.origin).sub(jf);let s=e.distanceTo(t)*.5,o=-this.direction.dot(Xc),a=Ar.dot(this.direction),l=-Ar.dot(Xc),c=Ar.lengthSq(),u=Math.abs(1-o*o),h,d,p,v;if(u>0)if(h=o*l-a,d=o*a-l,v=s*u,h>=0)if(d>=-v)if(d<=v){let _=1/u;h*=_,d*=_,p=h*(h+o*d+2*a)+d*(o*h+d+2*l)+c}else d=s,h=Math.max(0,-(o*d+a)),p=-h*h+d*(d+2*l)+c;else d=-s,h=Math.max(0,-(o*d+a)),p=-h*h+d*(d+2*l)+c;else d<=-v?(h=Math.max(0,-(-o*s+a)),d=h>0?-s:Math.min(Math.max(-s,-l),s),p=-h*h+d*(d+2*l)+c):d<=v?(h=0,d=Math.min(Math.max(-s,-l),s),p=d*(d+2*l)+c):(h=Math.max(0,-(o*s+a)),d=h>0?s:Math.min(Math.max(-s,-l),s),p=-h*h+d*(d+2*l)+c);else d=o>0?-s:s,h=Math.max(0,-(o*d+a)),p=-h*h+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,h),r&&r.copy(jf).addScaledVector(Xc,d),p}intersectSphere(e,t){Bi.subVectors(e.center,this.origin);let i=Bi.dot(this.direction),r=Bi.dot(Bi)-i*i,s=e.radius*e.radius;if(r>s)return null;let o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,l,c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(i=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(i=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),u>=0?(s=(e.min.y-d.y)*u,o=(e.max.y-d.y)*u):(s=(e.max.y-d.y)*u,o=(e.min.y-d.y)*u),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),h>=0?(a=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(a=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Bi)!==null}intersectTriangle(e,t,i,r,s){Kf.subVectors(t,e),qc.subVectors(i,e),Zf.crossVectors(Kf,qc);let o=this.direction.dot(Zf),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Ar.subVectors(this.origin,e);let l=a*this.direction.dot(qc.crossVectors(Ar,qc));if(l<0)return null;let c=a*this.direction.dot(Kf.cross(Ar));if(c<0||l+c>o)return null;let u=-a*Ar.dot(Zf);return u<0?null:this.at(u/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Ue=class n{constructor(e,t,i,r,s,o,a,l,c,u,h,d,p,v,_,m){n.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,o,a,l,c,u,h,d,p,v,_,m)}set(e,t,i,r,s,o,a,l,c,u,h,d,p,v,_,m){let f=this.elements;return f[0]=e,f[4]=t,f[8]=i,f[12]=r,f[1]=s,f[5]=o,f[9]=a,f[13]=l,f[2]=c,f[6]=u,f[10]=h,f[14]=d,f[3]=p,f[7]=v,f[11]=_,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,i=e.elements,r=1/io.setFromMatrixColumn(e,0).length(),s=1/io.setFromMatrixColumn(e,1).length(),o=1/io.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),u=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){let d=o*u,p=o*h,v=a*u,_=a*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=p+v*c,t[5]=d-_*c,t[9]=-a*l,t[2]=_-d*c,t[6]=v+p*c,t[10]=o*l}else if(e.order==="YXZ"){let d=l*u,p=l*h,v=c*u,_=c*h;t[0]=d+_*a,t[4]=v*a-p,t[8]=o*c,t[1]=o*h,t[5]=o*u,t[9]=-a,t[2]=p*a-v,t[6]=_+d*a,t[10]=o*l}else if(e.order==="ZXY"){let d=l*u,p=l*h,v=c*u,_=c*h;t[0]=d-_*a,t[4]=-o*h,t[8]=v+p*a,t[1]=p+v*a,t[5]=o*u,t[9]=_-d*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let d=o*u,p=o*h,v=a*u,_=a*h;t[0]=l*u,t[4]=v*c-p,t[8]=d*c+_,t[1]=l*h,t[5]=_*c+d,t[9]=p*c-v,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let d=o*l,p=o*c,v=a*l,_=a*c;t[0]=l*u,t[4]=_-d*h,t[8]=v*h+p,t[1]=h,t[5]=o*u,t[9]=-a*u,t[2]=-c*u,t[6]=p*h+v,t[10]=d-_*h}else if(e.order==="XZY"){let d=o*l,p=o*c,v=a*l,_=a*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+_,t[5]=o*u,t[9]=p*h-v,t[2]=v*h-p,t[6]=a*u,t[10]=_*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Jw,e,Qw)}lookAt(e,t,i){let r=this.elements;return On.subVectors(e,t),On.lengthSq()===0&&(On.z=1),On.normalize(),br.crossVectors(i,On),br.lengthSq()===0&&(Math.abs(i.z)===1?On.x+=1e-4:On.z+=1e-4,On.normalize(),br.crossVectors(i,On)),br.normalize(),Yc.crossVectors(On,br),r[0]=br.x,r[4]=Yc.x,r[8]=On.x,r[1]=br.y,r[5]=Yc.y,r[9]=On.y,r[2]=br.z,r[6]=Yc.z,r[10]=On.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],u=i[1],h=i[5],d=i[9],p=i[13],v=i[2],_=i[6],m=i[10],f=i[14],g=i[3],y=i[7],x=i[11],R=i[15],T=r[0],b=r[4],C=r[8],E=r[12],M=r[1],L=r[5],U=r[9],I=r[13],H=r[2],Y=r[6],q=r[10],te=r[14],k=r[3],$=r[7],Q=r[11],le=r[15];return s[0]=o*T+a*M+l*H+c*k,s[4]=o*b+a*L+l*Y+c*$,s[8]=o*C+a*U+l*q+c*Q,s[12]=o*E+a*I+l*te+c*le,s[1]=u*T+h*M+d*H+p*k,s[5]=u*b+h*L+d*Y+p*$,s[9]=u*C+h*U+d*q+p*Q,s[13]=u*E+h*I+d*te+p*le,s[2]=v*T+_*M+m*H+f*k,s[6]=v*b+_*L+m*Y+f*$,s[10]=v*C+_*U+m*q+f*Q,s[14]=v*E+_*I+m*te+f*le,s[3]=g*T+y*M+x*H+R*k,s[7]=g*b+y*L+x*Y+R*$,s[11]=g*C+y*U+x*q+R*Q,s[15]=g*E+y*I+x*te+R*le,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],p=e[14],v=e[3],_=e[7],m=e[11],f=e[15];return v*(+s*l*h-r*c*h-s*a*d+i*c*d+r*a*p-i*l*p)+_*(+t*l*p-t*c*d+s*o*d-r*o*p+r*c*u-s*l*u)+m*(+t*c*h-t*a*p-s*o*h+i*o*p+s*a*u-i*c*u)+f*(-r*a*u-t*l*h+t*a*d+r*o*h-i*o*d+i*l*u)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],p=e[11],v=e[12],_=e[13],m=e[14],f=e[15],g=h*m*c-_*d*c+_*l*p-a*m*p-h*l*f+a*d*f,y=v*d*c-u*m*c-v*l*p+o*m*p+u*l*f-o*d*f,x=u*_*c-v*h*c+v*a*p-o*_*p-u*a*f+o*h*f,R=v*h*l-u*_*l-v*a*d+o*_*d+u*a*m-o*h*m,T=t*g+i*y+r*x+s*R;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let b=1/T;return e[0]=g*b,e[1]=(_*d*s-h*m*s-_*r*p+i*m*p+h*r*f-i*d*f)*b,e[2]=(a*m*s-_*l*s+_*r*c-i*m*c-a*r*f+i*l*f)*b,e[3]=(h*l*s-a*d*s-h*r*c+i*d*c+a*r*p-i*l*p)*b,e[4]=y*b,e[5]=(u*m*s-v*d*s+v*r*p-t*m*p-u*r*f+t*d*f)*b,e[6]=(v*l*s-o*m*s-v*r*c+t*m*c+o*r*f-t*l*f)*b,e[7]=(o*d*s-u*l*s+u*r*c-t*d*c-o*r*p+t*l*p)*b,e[8]=x*b,e[9]=(v*h*s-u*_*s-v*i*p+t*_*p+u*i*f-t*h*f)*b,e[10]=(o*_*s-v*a*s+v*i*c-t*_*c-o*i*f+t*a*f)*b,e[11]=(u*a*s-o*h*s-u*i*c+t*h*c+o*i*p-t*a*p)*b,e[12]=R*b,e[13]=(u*_*r-v*h*r+v*i*d-t*_*d-u*i*m+t*h*m)*b,e[14]=(v*a*r-o*_*r-v*i*l+t*_*l+o*i*m-t*a*m)*b,e[15]=(o*h*r-u*a*r+u*i*l-t*h*l-o*i*d+t*a*d)*b,this}scale(e){let t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,l=e.z,c=s*o,u=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,u*a+i,u*l-r*o,0,c*l-r*a,u*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){let r=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,c=s+s,u=o+o,h=a+a,d=s*c,p=s*u,v=s*h,_=o*u,m=o*h,f=a*h,g=l*c,y=l*u,x=l*h,R=i.x,T=i.y,b=i.z;return r[0]=(1-(_+f))*R,r[1]=(p+x)*R,r[2]=(v-y)*R,r[3]=0,r[4]=(p-x)*T,r[5]=(1-(d+f))*T,r[6]=(m+g)*T,r[7]=0,r[8]=(v+y)*b,r[9]=(m-g)*b,r[10]=(1-(d+_))*b,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){let r=this.elements,s=io.set(r[0],r[1],r[2]).length(),o=io.set(r[4],r[5],r[6]).length(),a=io.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),e.x=r[12],e.y=r[13],e.z=r[14],li.copy(this);let c=1/s,u=1/o,h=1/a;return li.elements[0]*=c,li.elements[1]*=c,li.elements[2]*=c,li.elements[4]*=u,li.elements[5]*=u,li.elements[6]*=u,li.elements[8]*=h,li.elements[9]*=h,li.elements[10]*=h,t.setFromRotationMatrix(li),i.x=s,i.y=o,i.z=a,this}makePerspective(e,t,i,r,s,o,a=ji){let l=this.elements,c=2*s/(t-e),u=2*s/(i-r),h=(t+e)/(t-e),d=(i+r)/(i-r),p,v;if(a===ji)p=-(o+s)/(o-s),v=-2*o*s/(o-s);else if(a===xu)p=-o/(o-s),v=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=c,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=u,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=v,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,i,r,s,o,a=ji){let l=this.elements,c=1/(t-e),u=1/(i-r),h=1/(o-s),d=(t+e)*c,p=(i+r)*u,v,_;if(a===ji)v=(o+s)*h,_=-2*h;else if(a===xu)v=s*h,_=-1*h;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*u,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=_,l[14]=-v,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},io=new P,li=new Ue,Jw=new P(0,0,0),Qw=new P(1,1,1),br=new P,Yc=new P,On=new P,u_=new Ue,h_=new bn,Ei=class n{constructor(e=0,t=0,i=0,r=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],l=r[1],c=r[5],u=r[9],h=r[2],d=r[6],p=r[10];switch(t){case"XYZ":this._y=Math.asin(ln(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,p),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ln(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(ln(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,p),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-ln(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(ln(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-ln(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-u,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return u_.makeRotationFromQuaternion(e),this.setFromRotationMatrix(u_,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return h_.setFromEuler(this),this.setFromQuaternion(h_,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Ei.DEFAULT_ORDER="XYZ";var tl=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},eE=0,d_=new P,ro=new bn,Vi=new Ue,jc=new P,Va=new P,tE=new P,nE=new bn,f_=new P(1,0,0),p_=new P(0,1,0),m_=new P(0,0,1),g_={type:"added"},iE={type:"removed"},so={type:"childadded",child:null},$f={type:"childremoved",child:null},Tt=class n extends Ki{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:eE++}),this.uuid=di(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new P,t=new Ei,i=new bn,r=new P(1,1,1);function s(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Ue},normalMatrix:{value:new Ge}}),this.matrix=new Ue,this.matrixWorld=new Ue,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new tl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return ro.setFromAxisAngle(e,t),this.quaternion.multiply(ro),this}rotateOnWorldAxis(e,t){return ro.setFromAxisAngle(e,t),this.quaternion.premultiply(ro),this}rotateX(e){return this.rotateOnAxis(f_,e)}rotateY(e){return this.rotateOnAxis(p_,e)}rotateZ(e){return this.rotateOnAxis(m_,e)}translateOnAxis(e,t){return d_.copy(e).applyQuaternion(this.quaternion),this.position.add(d_.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(f_,e)}translateY(e){return this.translateOnAxis(p_,e)}translateZ(e){return this.translateOnAxis(m_,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Vi.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?jc.copy(e):jc.set(e,t,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Va.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Vi.lookAt(Va,jc,this.up):Vi.lookAt(jc,Va,this.up),this.quaternion.setFromRotationMatrix(Vi),r&&(Vi.extractRotation(r.matrixWorld),ro.setFromRotationMatrix(Vi),this.quaternion.premultiply(ro.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(g_),so.child=e,this.dispatchEvent(so),so.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(iE),$f.child=e,this.dispatchEvent($f),$f.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Vi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Vi.multiply(e.parent.matrixWorld)),e.applyMatrix4(Vi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(g_),so.child=e,this.dispatchEvent(so),so.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){let o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Va,e,tE),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Va,nE,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,r=t.length;i<r;i++){let s=t[i];(s.matrixWorldAutoUpdate===!0||e===!0)&&s.updateMatrixWorld(e)}}updateWorldMatrix(e,t){let i=this.parent;if(e===!0&&i!==null&&i.matrixWorldAutoUpdate===!0&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){let r=this.children;for(let s=0,o=r.length;s<o;s++){let a=r[s];a.matrixWorldAutoUpdate===!0&&a.updateWorldMatrix(!1,!0)}}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.visibility=this._visibility,r.active=this._active,r.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),r.maxGeometryCount=this._maxGeometryCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.geometryCount=this._geometryCount,r.matricesTexture=this._matricesTexture.toJSON(e),this.boundingSphere!==null&&(r.boundingSphere={center:r.boundingSphere.center.toArray(),radius:r.boundingSphere.radius}),this.boundingBox!==null&&(r.boundingBox={min:r.boundingBox.min.toArray(),max:r.boundingBox.max.toArray()}));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){let h=l[c];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];r.animations.push(s(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),u=o(e.images),h=o(e.shapes),d=o(e.skeletons),p=o(e.animations),v=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),h.length>0&&(i.shapes=h),d.length>0&&(i.skeletons=d),p.length>0&&(i.animations=p),v.length>0&&(i.nodes=v)}return i.object=r,i;function o(a){let l=[];for(let c in a){let u=a[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};Tt.DEFAULT_UP=new P(0,1,0);Tt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Tt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var ci=new P,Hi=new P,Jf=new P,Gi=new P,oo=new P,ao=new P,v_=new P,Qf=new P,ep=new P,tp=new P,xo=class n{constructor(e=new P,t=new P,i=new P){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),ci.subVectors(e,t),r.cross(ci);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){ci.subVectors(r,t),Hi.subVectors(i,t),Jf.subVectors(e,t);let o=ci.dot(ci),a=ci.dot(Hi),l=ci.dot(Jf),c=Hi.dot(Hi),u=Hi.dot(Jf),h=o*c-a*a;if(h===0)return s.set(0,0,0),null;let d=1/h,p=(c*l-a*u)*d,v=(o*u-a*l)*d;return s.set(1-p-v,v,p)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Gi)===null?!1:Gi.x>=0&&Gi.y>=0&&Gi.x+Gi.y<=1}static getInterpolation(e,t,i,r,s,o,a,l){return this.getBarycoord(e,t,i,r,Gi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Gi.x),l.addScaledVector(o,Gi.y),l.addScaledVector(a,Gi.z),l)}static isFrontFacing(e,t,i,r){return ci.subVectors(i,t),Hi.subVectors(e,t),ci.cross(Hi).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return ci.subVectors(this.c,this.b),Hi.subVectors(this.a,this.b),ci.cross(Hi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return n.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,r=this.b,s=this.c,o,a;oo.subVectors(r,i),ao.subVectors(s,i),Qf.subVectors(e,i);let l=oo.dot(Qf),c=ao.dot(Qf);if(l<=0&&c<=0)return t.copy(i);ep.subVectors(e,r);let u=oo.dot(ep),h=ao.dot(ep);if(u>=0&&h<=u)return t.copy(r);let d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return o=l/(l-u),t.copy(i).addScaledVector(oo,o);tp.subVectors(e,s);let p=oo.dot(tp),v=ao.dot(tp);if(v>=0&&p<=v)return t.copy(s);let _=p*c-l*v;if(_<=0&&c>=0&&v<=0)return a=c/(c-v),t.copy(i).addScaledVector(ao,a);let m=u*v-p*h;if(m<=0&&h-u>=0&&p-v>=0)return v_.subVectors(s,r),a=(h-u)/(h-u+(p-v)),t.copy(r).addScaledVector(v_,a);let f=1/(m+_+d);return o=_*f,a=d*f,t.copy(i).addScaledVector(oo,o).addScaledVector(ao,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Rx={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Rr={h:0,s:0,l:0},Kc={h:0,s:0,l:0};function np(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var we=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=wt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,nt.toWorkingColorSpace(this,t),this}setRGB(e,t,i,r=nt.workingColorSpace){return this.r=e,this.g=t,this.b=i,nt.toWorkingColorSpace(this,r),this}setHSL(e,t,i,r=nt.workingColorSpace){if(e=im(e,1),t=ln(t,0,1),i=ln(i,0,1),t===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+t):i+t-i*t,o=2*i-s;this.r=np(o,s,e+1/3),this.g=np(o,s,e),this.b=np(o,s,e-1/3)}return nt.toWorkingColorSpace(this,r),this}setStyle(e,t=wt){function i(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(s,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=wt){let i=Rx[e.toLowerCase()];return i!==void 0?this.setHex(i,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Eo(e.r),this.g=Eo(e.g),this.b=Eo(e.b),this}copyLinearToSRGB(e){return this.r=Gf(e.r),this.g=Gf(e.g),this.b=Gf(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=wt){return nt.fromWorkingColorSpace(an.copy(this),e),Math.round(ln(an.r*255,0,255))*65536+Math.round(ln(an.g*255,0,255))*256+Math.round(ln(an.b*255,0,255))}getHexString(e=wt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=nt.workingColorSpace){nt.fromWorkingColorSpace(an.copy(this),t);let i=an.r,r=an.g,s=an.b,o=Math.max(i,r,s),a=Math.min(i,r,s),l,c,u=(a+o)/2;if(a===o)l=0,c=0;else{let h=o-a;switch(c=u<=.5?h/(o+a):h/(2-o-a),o){case i:l=(r-s)/h+(r<s?6:0);break;case r:l=(s-i)/h+2;break;case s:l=(i-r)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=nt.workingColorSpace){return nt.fromWorkingColorSpace(an.copy(this),t),e.r=an.r,e.g=an.g,e.b=an.b,e}getStyle(e=wt){nt.fromWorkingColorSpace(an.copy(this),e);let t=an.r,i=an.g,r=an.b;return e!==wt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(Rr),this.setHSL(Rr.h+e,Rr.s+t,Rr.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(Rr),e.getHSL(Kc);let i=Za(Rr.h,Kc.h,t),r=Za(Rr.s,Kc.s,t),s=Za(Rr.l,Kc.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},an=new we;we.NAMES=Rx;var rE=0,zn=class extends Ki{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:rE++}),this.uuid=di(),this.name="",this.type="Material",this.blending=So,this.side=Zn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=vp,this.blendDst=yp,this.blendEquation=ds,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new we(0,0,0),this.blendAlpha=0,this.depthFunc=mu,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=i_,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Js,this.stencilZFail=Js,this.stencilZPass=Js,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==So&&(i.blending=this.blending),this.side!==Zn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==vp&&(i.blendSrc=this.blendSrc),this.blendDst!==yp&&(i.blendDst=this.blendDst),this.blendEquation!==ds&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==mu&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==i_&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Js&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Js&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Js&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){let o=[];for(let a in s){let l=s[a];delete l.metadata,o.push(l)}return o}if(t){let s=r(e.textures),o=r(e.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}},qt=class extends zn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new we(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ei,this.combine=fx,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}};var Nt=new P,Zc=new Le,Ct=class{constructor(e,t,i=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Mp,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=Si,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return bx("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)Zc.fromBufferAttribute(this,t),Zc.applyMatrix3(e),this.setXY(t,Zc.x,Zc.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.applyMatrix3(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.applyMatrix4(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.applyNormalMatrix(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.transformDirection(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=ui(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=at(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=ui(t,this.array)),t}setX(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=ui(t,this.array)),t}setY(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=ui(t,this.array)),t}setZ(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=ui(t,this.array)),t}setW(e,t){return this.normalized&&(t=at(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=at(t,this.array),i=at(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=at(t,this.array),i=at(i,this.array),r=at(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=at(t,this.array),i=at(i,this.array),r=at(r,this.array),s=at(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Mp&&(e.usage=this.usage),e}};var wu=class extends Ct{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var Eu=class extends Ct{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var Et=class extends Ct{constructor(e,t,i){super(new Float32Array(e),t,i)}},sE=0,Kn=new Ue,ip=new Tt,lo=new P,Fn=new Rn,Ha=new Rn,Wt=new P,Yt=class n extends Ki{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:sE++}),this.uuid=di(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Ax(e)?Eu:wu)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let s=new Ge().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Kn.makeRotationFromQuaternion(e),this.applyMatrix4(Kn),this}rotateX(e){return Kn.makeRotationX(e),this.applyMatrix4(Kn),this}rotateY(e){return Kn.makeRotationY(e),this.applyMatrix4(Kn),this}rotateZ(e){return Kn.makeRotationZ(e),this.applyMatrix4(Kn),this}translate(e,t,i){return Kn.makeTranslation(e,t,i),this.applyMatrix4(Kn),this}scale(e,t,i){return Kn.makeScale(e,t,i),this.applyMatrix4(Kn),this}lookAt(e){return ip.lookAt(e),ip.updateMatrix(),this.applyMatrix4(ip.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(lo).negate(),this.translate(lo.x,lo.y,lo.z),this}setFromPoints(e){let t=[];for(let i=0,r=e.length;i<r;i++){let s=e[i];t.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new Et(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Rn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new P(-1/0,-1/0,-1/0),new P(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){let s=t[i];Fn.setFromBufferAttribute(s),this.morphTargetsRelative?(Wt.addVectors(this.boundingBox.min,Fn.min),this.boundingBox.expandByPoint(Wt),Wt.addVectors(this.boundingBox.max,Fn.max),this.boundingBox.expandByPoint(Wt)):(this.boundingBox.expandByPoint(Fn.min),this.boundingBox.expandByPoint(Fn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new kn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new P,1/0);return}if(e){let i=this.boundingSphere.center;if(Fn.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];Ha.setFromBufferAttribute(a),this.morphTargetsRelative?(Wt.addVectors(Fn.min,Ha.min),Fn.expandByPoint(Wt),Wt.addVectors(Fn.max,Ha.max),Fn.expandByPoint(Wt)):(Fn.expandByPoint(Ha.min),Fn.expandByPoint(Ha.max))}Fn.getCenter(i);let r=0;for(let s=0,o=e.count;s<o;s++)Wt.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Wt));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)Wt.fromBufferAttribute(a,c),l&&(lo.fromBufferAttribute(e,c),Wt.add(lo)),r=Math.max(r,i.distanceToSquared(Wt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,r=t.normal,s=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Ct(new Float32Array(4*i.count),4));let o=this.getAttribute("tangent"),a=[],l=[];for(let C=0;C<i.count;C++)a[C]=new P,l[C]=new P;let c=new P,u=new P,h=new P,d=new Le,p=new Le,v=new Le,_=new P,m=new P;function f(C,E,M){c.fromBufferAttribute(i,C),u.fromBufferAttribute(i,E),h.fromBufferAttribute(i,M),d.fromBufferAttribute(s,C),p.fromBufferAttribute(s,E),v.fromBufferAttribute(s,M),u.sub(c),h.sub(c),p.sub(d),v.sub(d);let L=1/(p.x*v.y-v.x*p.y);isFinite(L)&&(_.copy(u).multiplyScalar(v.y).addScaledVector(h,-p.y).multiplyScalar(L),m.copy(h).multiplyScalar(p.x).addScaledVector(u,-v.x).multiplyScalar(L),a[C].add(_),a[E].add(_),a[M].add(_),l[C].add(m),l[E].add(m),l[M].add(m))}let g=this.groups;g.length===0&&(g=[{start:0,count:e.count}]);for(let C=0,E=g.length;C<E;++C){let M=g[C],L=M.start,U=M.count;for(let I=L,H=L+U;I<H;I+=3)f(e.getX(I+0),e.getX(I+1),e.getX(I+2))}let y=new P,x=new P,R=new P,T=new P;function b(C){R.fromBufferAttribute(r,C),T.copy(R);let E=a[C];y.copy(E),y.sub(R.multiplyScalar(R.dot(E))).normalize(),x.crossVectors(T,E);let L=x.dot(l[C])<0?-1:1;o.setXYZW(C,y.x,y.y,y.z,L)}for(let C=0,E=g.length;C<E;++C){let M=g[C],L=M.start,U=M.count;for(let I=L,H=L+U;I<H;I+=3)b(e.getX(I+0)),b(e.getX(I+1)),b(e.getX(I+2))}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new Ct(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let d=0,p=i.count;d<p;d++)i.setXYZ(d,0,0,0);let r=new P,s=new P,o=new P,a=new P,l=new P,c=new P,u=new P,h=new P;if(e)for(let d=0,p=e.count;d<p;d+=3){let v=e.getX(d+0),_=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,v),s.fromBufferAttribute(t,_),o.fromBufferAttribute(t,m),u.subVectors(o,s),h.subVectors(r,s),u.cross(h),a.fromBufferAttribute(i,v),l.fromBufferAttribute(i,_),c.fromBufferAttribute(i,m),a.add(u),l.add(u),c.add(u),i.setXYZ(v,a.x,a.y,a.z),i.setXYZ(_,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=t.count;d<p;d+=3)r.fromBufferAttribute(t,d+0),s.fromBufferAttribute(t,d+1),o.fromBufferAttribute(t,d+2),u.subVectors(o,s),h.subVectors(r,s),u.cross(h),i.setXYZ(d+0,u.x,u.y,u.z),i.setXYZ(d+1,u.x,u.y,u.z),i.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Wt.fromBufferAttribute(e,t),Wt.normalize(),e.setXYZ(t,Wt.x,Wt.y,Wt.z)}toNonIndexed(){function e(a,l){let c=a.array,u=a.itemSize,h=a.normalized,d=new c.constructor(l.length*u),p=0,v=0;for(let _=0,m=l.length;_<m;_++){a.isInterleavedBufferAttribute?p=l[_]*a.data.stride+a.offset:p=l[_]*u;for(let f=0;f<u;f++)d[v++]=c[p++]}return new Ct(d,u,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,r=this.attributes;for(let a in r){let l=r[a],c=e(l,i);t.setAttribute(a,c)}let s=this.morphAttributes;for(let a in s){let l=[],c=s[a];for(let u=0,h=c.length;u<h;u++){let d=c[u],p=e(d,i);l.push(p)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){let p=c[h];u.push(p.toJSON(e.data))}u.length>0&&(r[l]=u,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone(t));let r=e.attributes;for(let c in r){let u=r[c];this.setAttribute(c,u.clone(t))}let s=e.morphAttributes;for(let c in s){let u=[],h=s[c];for(let d=0,p=h.length;d<p;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,u=o.length;c<u;c++){let h=o[c];this.addGroup(h.start,h.count,h.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},y_=new Ue,as=new $i,$c=new kn,__=new P,co=new P,uo=new P,ho=new P,rp=new P,Jc=new P,Qc=new Le,eu=new Le,tu=new Le,x_=new P,M_=new P,S_=new P,nu=new P,iu=new P,st=class extends Tt{constructor(e=new Yt,t=new qt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(e,t){let i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(r,e);let a=this.morphTargetInfluences;if(s&&a){Jc.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let u=a[l],h=s[l];u!==0&&(rp.fromBufferAttribute(h,e),o?Jc.addScaledVector(rp,u):Jc.addScaledVector(rp.sub(t),u))}t.add(Jc)}return t}raycast(e,t){let i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),$c.copy(i.boundingSphere),$c.applyMatrix4(s),as.copy(e.ray).recast(e.near),!($c.containsPoint(as.origin)===!1&&(as.intersectSphere($c,__)===null||as.origin.distanceToSquared(__)>(e.far-e.near)**2))&&(y_.copy(s).invert(),as.copy(e.ray).applyMatrix4(y_),!(i.boundingBox!==null&&as.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,as)))}_computeIntersections(e,t,i){let r,s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,c=s.attributes.uv,u=s.attributes.uv1,h=s.attributes.normal,d=s.groups,p=s.drawRange;if(a!==null)if(Array.isArray(o))for(let v=0,_=d.length;v<_;v++){let m=d[v],f=o[m.materialIndex],g=Math.max(m.start,p.start),y=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let x=g,R=y;x<R;x+=3){let T=a.getX(x),b=a.getX(x+1),C=a.getX(x+2);r=ru(this,f,e,i,c,u,h,T,b,C),r&&(r.faceIndex=Math.floor(x/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{let v=Math.max(0,p.start),_=Math.min(a.count,p.start+p.count);for(let m=v,f=_;m<f;m+=3){let g=a.getX(m),y=a.getX(m+1),x=a.getX(m+2);r=ru(this,o,e,i,c,u,h,g,y,x),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let v=0,_=d.length;v<_;v++){let m=d[v],f=o[m.materialIndex],g=Math.max(m.start,p.start),y=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let x=g,R=y;x<R;x+=3){let T=x,b=x+1,C=x+2;r=ru(this,f,e,i,c,u,h,T,b,C),r&&(r.faceIndex=Math.floor(x/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{let v=Math.max(0,p.start),_=Math.min(l.count,p.start+p.count);for(let m=v,f=_;m<f;m+=3){let g=m,y=m+1,x=m+2;r=ru(this,o,e,i,c,u,h,g,y,x),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}}};function oE(n,e,t,i,r,s,o,a){let l;if(e.side===Xt?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,e.side===Zn,a),l===null)return null;iu.copy(a),iu.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(iu);return c<t.near||c>t.far?null:{distance:c,point:iu.clone(),object:n}}function ru(n,e,t,i,r,s,o,a,l,c){n.getVertexPosition(a,co),n.getVertexPosition(l,uo),n.getVertexPosition(c,ho);let u=oE(n,e,t,i,co,uo,ho,nu);if(u){r&&(Qc.fromBufferAttribute(r,a),eu.fromBufferAttribute(r,l),tu.fromBufferAttribute(r,c),u.uv=xo.getInterpolation(nu,co,uo,ho,Qc,eu,tu,new Le)),s&&(Qc.fromBufferAttribute(s,a),eu.fromBufferAttribute(s,l),tu.fromBufferAttribute(s,c),u.uv1=xo.getInterpolation(nu,co,uo,ho,Qc,eu,tu,new Le)),o&&(x_.fromBufferAttribute(o,a),M_.fromBufferAttribute(o,l),S_.fromBufferAttribute(o,c),u.normal=xo.getInterpolation(nu,co,uo,ho,x_,M_,S_,new P),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));let h={a,b:l,c,normal:new P,materialIndex:0};xo.getNormal(co,uo,ho,h.normal),u.face=h}return u}var nl=class n extends Yt{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};let a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);let l=[],c=[],u=[],h=[],d=0,p=0;v("z","y","x",-1,-1,i,t,e,o,s,0),v("z","y","x",1,-1,i,t,-e,o,s,1),v("x","z","y",1,1,e,i,t,r,o,2),v("x","z","y",1,-1,e,i,-t,r,o,3),v("x","y","z",1,-1,e,t,i,r,s,4),v("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new Et(c,3)),this.setAttribute("normal",new Et(u,3)),this.setAttribute("uv",new Et(h,2));function v(_,m,f,g,y,x,R,T,b,C,E){let M=x/b,L=R/C,U=x/2,I=R/2,H=T/2,Y=b+1,q=C+1,te=0,k=0,$=new P;for(let Q=0;Q<q;Q++){let le=Q*L-I;for(let be=0;be<Y;be++){let Te=be*M-U;$[_]=Te*g,$[m]=le*y,$[f]=H,c.push($.x,$.y,$.z),$[_]=0,$[m]=0,$[f]=T>0?1:-1,u.push($.x,$.y,$.z),h.push(be/b),h.push(1-Q/C),te+=1}}for(let Q=0;Q<C;Q++)for(let le=0;le<b;le++){let be=d+le+Y*Q,Te=d+le+Y*(Q+1),X=d+(le+1)+Y*(Q+1),re=d+(le+1)+Y*Q;l.push(be,Te,re),l.push(Te,X,re),k+=6}a.addGroup(p,k,E),p+=k,d+=te}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};function Io(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let r=n[t][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone():Array.isArray(r)?e[t][i]=r.slice():e[t][i]=r}}return e}function vn(n){let e={};for(let t=0;t<n.length;t++){let i=Io(n[t]);for(let r in i)e[r]=i[r]}return e}function aE(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Cx(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:nt.workingColorSpace}var lE={clone:Io,merge:vn},cE=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,uE=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,_n=class extends zn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=cE,this.fragmentShader=uE,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Io(e.uniforms),this.uniformsGroups=aE(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let o=this.uniforms[r].value;o&&o.isTexture?t.uniforms[r]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[r]={type:"m4",value:o.toArray()}:t.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}},Tu=class extends Tt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ue,this.projectionMatrix=new Ue,this.projectionMatrixInverse=new Ue,this.coordinateSystem=ji}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},Cr=new P,w_=new Le,E_=new Le,Ft=class extends Tu{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Po*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Ka*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Po*2*Math.atan(Math.tan(Ka*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){Cr.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Cr.x,Cr.y).multiplyScalar(-e/Cr.z),Cr.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Cr.x,Cr.y).multiplyScalar(-e/Cr.z)}getViewSize(e,t){return this.getViewBounds(e,w_,E_),t.subVectors(E_,w_)}setViewOffset(e,t,i,r,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Ka*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*r/l,t-=o.offsetY*i/c,r*=o.width/l,i*=o.height/c}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},fo=-90,po=1,Tp=class extends Tt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Ft(fo,po,e,t);r.layers=this.layers,this.add(r);let s=new Ft(fo,po,e,t);s.layers=this.layers,this.add(s);let o=new Ft(fo,po,e,t);o.layers=this.layers,this.add(o);let a=new Ft(fo,po,e,t);a.layers=this.layers,this.add(a);let l=new Ft(fo,po,e,t);l.layers=this.layers,this.add(l);let c=new Ft(fo,po,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,r,s,o,a,l]=t;for(let c of t)this.remove(c);if(e===ji)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===xu)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,o,a,l,c,u]=this.children,h=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),v=e.xr.enabled;e.xr.enabled=!1;let _=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0,r),e.render(t,s),e.setRenderTarget(i,1,r),e.render(t,o),e.setRenderTarget(i,2,r),e.render(t,a),e.setRenderTarget(i,3,r),e.render(t,l),e.setRenderTarget(i,4,r),e.render(t,c),i.texture.generateMipmaps=_,e.setRenderTarget(i,5,r),e.render(t,u),e.setRenderTarget(h,d,p),e.xr.enabled=v,i.texture.needsPMREMUpdate=!0}},Au=class extends Dt{constructor(e,t,i,r,s,o,a,l,c,u){e=e!==void 0?e:[],t=t!==void 0?t:Ao,super(e,t,i,r,s,o,a,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Ap=class extends Zi{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new Au(r,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:An}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new nl(5,5,5),s=new _n({name:"CubemapFromEquirect",uniforms:Io(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Xt,blending:Lr});s.uniforms.tEquirect.value=t;let o=new st(r,s),a=t.minFilter;return t.minFilter===Mi&&(t.minFilter=An),new Tp(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,i,r){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}},sp=new P,hE=new P,dE=new Ge,qi=class{constructor(e=new P(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let r=sp.subVectors(i,t).cross(hE.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){let i=e.delta(sp),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let s=-(e.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||dE.getNormalMatrix(e),r=this.coplanarPoint(sp).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},ls=new kn,su=new P,il=class{constructor(e=new qi,t=new qi,i=new qi,r=new qi,s=new qi,o=new qi){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=ji){let i=this.planes,r=e.elements,s=r[0],o=r[1],a=r[2],l=r[3],c=r[4],u=r[5],h=r[6],d=r[7],p=r[8],v=r[9],_=r[10],m=r[11],f=r[12],g=r[13],y=r[14],x=r[15];if(i[0].setComponents(l-s,d-c,m-p,x-f).normalize(),i[1].setComponents(l+s,d+c,m+p,x+f).normalize(),i[2].setComponents(l+o,d+u,m+v,x+g).normalize(),i[3].setComponents(l-o,d-u,m-v,x-g).normalize(),i[4].setComponents(l-a,d-h,m-_,x-y).normalize(),t===ji)i[5].setComponents(l+a,d+h,m+_,x+y).normalize();else if(t===xu)i[5].setComponents(a,h,_,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ls.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ls.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ls)}intersectsSprite(e){return ls.center.set(0,0,0),ls.radius=.7071067811865476,ls.applyMatrix4(e.matrixWorld),this.intersectsSphere(ls)}intersectsSphere(e){let t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let r=t[i];if(su.x=r.normal.x>0?e.max.x:e.min.x,su.y=r.normal.y>0?e.max.y:e.min.y,su.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(su)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function Px(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function fE(n){let e=new WeakMap;function t(a,l){let c=a.array,u=a.usage,h=c.byteLength,d=n.createBuffer();n.bindBuffer(l,d),n.bufferData(l,c,u),a.onUploadCallback();let p;if(c instanceof Float32Array)p=n.FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?p=n.HALF_FLOAT:p=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=n.SHORT;else if(c instanceof Uint32Array)p=n.UNSIGNED_INT;else if(c instanceof Int32Array)p=n.INT;else if(c instanceof Int8Array)p=n.BYTE;else if(c instanceof Uint8Array)p=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:h}}function i(a,l,c){let u=l.array,h=l._updateRange,d=l.updateRanges;if(n.bindBuffer(c,a),h.count===-1&&d.length===0&&n.bufferSubData(c,0,u),d.length!==0){for(let p=0,v=d.length;p<v;p++){let _=d[p];n.bufferSubData(c,_.start*u.BYTES_PER_ELEMENT,u,_.start,_.count)}l.clearUpdateRanges()}h.count!==-1&&(n.bufferSubData(c,h.offset*u.BYTES_PER_ELEMENT,u,h.offset,h.count),h.count=-1),l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(n.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isGLBufferAttribute){let u=e.get(a);(!u||u.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}a.isInterleavedBufferAttribute&&(a=a.data);let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var Lo=class n extends Yt{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};let s=e/2,o=t/2,a=Math.floor(i),l=Math.floor(r),c=a+1,u=l+1,h=e/a,d=t/l,p=[],v=[],_=[],m=[];for(let f=0;f<u;f++){let g=f*d-o;for(let y=0;y<c;y++){let x=y*h-s;v.push(x,-g,0),_.push(0,0,1),m.push(y/a),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let g=0;g<a;g++){let y=g+c*f,x=g+c*(f+1),R=g+1+c*(f+1),T=g+1+c*f;p.push(y,x,T),p.push(x,R,T)}this.setIndex(p),this.setAttribute("position",new Et(v,3)),this.setAttribute("normal",new Et(_,3)),this.setAttribute("uv",new Et(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}},pE=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,mE=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,gE=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,vE=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,yE=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,_E=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,xE=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,ME=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,SE=`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,wE=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,EE=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,TE=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,AE=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,bE=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,RE=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,CE=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,PE=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,IE=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,LE=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,NE=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,DE=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,UE=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,OE=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,FE=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,kE=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,zE=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,BE=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,VE=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,HE=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,GE=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,WE="gl_FragColor = linearToOutputTexel( gl_FragColor );",XE=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,qE=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,YE=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,jE=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,KE=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ZE=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,$E=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,JE=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,QE=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,eT=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,tT=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,nT=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,iT=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,rT=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,sT=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,oT=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,aT=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lT=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,cT=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,uT=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,hT=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,dT=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,fT=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,pT=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,mT=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,gT=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,vT=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,yT=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,_T=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,xT=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,MT=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,ST=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,wT=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ET=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,TT=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,AT=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[MORPHTARGETS_COUNT];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,bT=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,RT=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,CT=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
	#endif
	#ifdef MORPHTARGETS_TEXTURE
		#ifndef USE_INSTANCING_MORPH
			uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		#endif
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,PT=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,IT=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,LT=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,NT=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,DT=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,UT=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,OT=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,FT=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,kT=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,zT=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,BT=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,VT=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,HT=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,GT=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,WT=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,XT=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,qT=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,YT=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,jT=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,KT=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return shadow;
	}
#endif`,ZT=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,$T=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,JT=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,QT=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,eA=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,tA=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,nA=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,iA=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,rA=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,sA=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,oA=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,aA=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,lA=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,cA=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uA=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,hA=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,dA=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,fA=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,pA=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,mA=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,gA=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,vA=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,yA=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_A=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,xA=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,MA=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,SA=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,wA=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,EA=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,TA=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,AA=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,bA=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,RA=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,CA=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,PA=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,IA=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,LA=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,NA=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,DA=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,UA=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,OA=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,FA=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,kA=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,zA=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,BA=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,VA=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,HA=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,GA=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,WA=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,XA=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,qA=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,He={alphahash_fragment:pE,alphahash_pars_fragment:mE,alphamap_fragment:gE,alphamap_pars_fragment:vE,alphatest_fragment:yE,alphatest_pars_fragment:_E,aomap_fragment:xE,aomap_pars_fragment:ME,batching_pars_vertex:SE,batching_vertex:wE,begin_vertex:EE,beginnormal_vertex:TE,bsdfs:AE,iridescence_fragment:bE,bumpmap_pars_fragment:RE,clipping_planes_fragment:CE,clipping_planes_pars_fragment:PE,clipping_planes_pars_vertex:IE,clipping_planes_vertex:LE,color_fragment:NE,color_pars_fragment:DE,color_pars_vertex:UE,color_vertex:OE,common:FE,cube_uv_reflection_fragment:kE,defaultnormal_vertex:zE,displacementmap_pars_vertex:BE,displacementmap_vertex:VE,emissivemap_fragment:HE,emissivemap_pars_fragment:GE,colorspace_fragment:WE,colorspace_pars_fragment:XE,envmap_fragment:qE,envmap_common_pars_fragment:YE,envmap_pars_fragment:jE,envmap_pars_vertex:KE,envmap_physical_pars_fragment:oT,envmap_vertex:ZE,fog_vertex:$E,fog_pars_vertex:JE,fog_fragment:QE,fog_pars_fragment:eT,gradientmap_pars_fragment:tT,lightmap_pars_fragment:nT,lights_lambert_fragment:iT,lights_lambert_pars_fragment:rT,lights_pars_begin:sT,lights_toon_fragment:aT,lights_toon_pars_fragment:lT,lights_phong_fragment:cT,lights_phong_pars_fragment:uT,lights_physical_fragment:hT,lights_physical_pars_fragment:dT,lights_fragment_begin:fT,lights_fragment_maps:pT,lights_fragment_end:mT,logdepthbuf_fragment:gT,logdepthbuf_pars_fragment:vT,logdepthbuf_pars_vertex:yT,logdepthbuf_vertex:_T,map_fragment:xT,map_pars_fragment:MT,map_particle_fragment:ST,map_particle_pars_fragment:wT,metalnessmap_fragment:ET,metalnessmap_pars_fragment:TT,morphinstance_vertex:AT,morphcolor_vertex:bT,morphnormal_vertex:RT,morphtarget_pars_vertex:CT,morphtarget_vertex:PT,normal_fragment_begin:IT,normal_fragment_maps:LT,normal_pars_fragment:NT,normal_pars_vertex:DT,normal_vertex:UT,normalmap_pars_fragment:OT,clearcoat_normal_fragment_begin:FT,clearcoat_normal_fragment_maps:kT,clearcoat_pars_fragment:zT,iridescence_pars_fragment:BT,opaque_fragment:VT,packing:HT,premultiplied_alpha_fragment:GT,project_vertex:WT,dithering_fragment:XT,dithering_pars_fragment:qT,roughnessmap_fragment:YT,roughnessmap_pars_fragment:jT,shadowmap_pars_fragment:KT,shadowmap_pars_vertex:ZT,shadowmap_vertex:$T,shadowmask_pars_fragment:JT,skinbase_vertex:QT,skinning_pars_vertex:eA,skinning_vertex:tA,skinnormal_vertex:nA,specularmap_fragment:iA,specularmap_pars_fragment:rA,tonemapping_fragment:sA,tonemapping_pars_fragment:oA,transmission_fragment:aA,transmission_pars_fragment:lA,uv_pars_fragment:cA,uv_pars_vertex:uA,uv_vertex:hA,worldpos_vertex:dA,background_vert:fA,background_frag:pA,backgroundCube_vert:mA,backgroundCube_frag:gA,cube_vert:vA,cube_frag:yA,depth_vert:_A,depth_frag:xA,distanceRGBA_vert:MA,distanceRGBA_frag:SA,equirect_vert:wA,equirect_frag:EA,linedashed_vert:TA,linedashed_frag:AA,meshbasic_vert:bA,meshbasic_frag:RA,meshlambert_vert:CA,meshlambert_frag:PA,meshmatcap_vert:IA,meshmatcap_frag:LA,meshnormal_vert:NA,meshnormal_frag:DA,meshphong_vert:UA,meshphong_frag:OA,meshphysical_vert:FA,meshphysical_frag:kA,meshtoon_vert:zA,meshtoon_frag:BA,points_vert:VA,points_frag:HA,shadow_vert:GA,shadow_frag:WA,sprite_vert:XA,sprite_frag:qA},ue={common:{diffuse:{value:new we(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ge},alphaMap:{value:null},alphaMapTransform:{value:new Ge},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ge}},envmap:{envMap:{value:null},envMapRotation:{value:new Ge},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ge}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ge}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ge},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ge},normalScale:{value:new Le(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ge},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ge}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ge}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ge}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new we(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new we(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ge},alphaTest:{value:0},uvTransform:{value:new Ge}},sprite:{diffuse:{value:new we(16777215)},opacity:{value:1},center:{value:new Le(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ge},alphaMap:{value:null},alphaMapTransform:{value:new Ge},alphaTest:{value:0}}},xi={basic:{uniforms:vn([ue.common,ue.specularmap,ue.envmap,ue.aomap,ue.lightmap,ue.fog]),vertexShader:He.meshbasic_vert,fragmentShader:He.meshbasic_frag},lambert:{uniforms:vn([ue.common,ue.specularmap,ue.envmap,ue.aomap,ue.lightmap,ue.emissivemap,ue.bumpmap,ue.normalmap,ue.displacementmap,ue.fog,ue.lights,{emissive:{value:new we(0)}}]),vertexShader:He.meshlambert_vert,fragmentShader:He.meshlambert_frag},phong:{uniforms:vn([ue.common,ue.specularmap,ue.envmap,ue.aomap,ue.lightmap,ue.emissivemap,ue.bumpmap,ue.normalmap,ue.displacementmap,ue.fog,ue.lights,{emissive:{value:new we(0)},specular:{value:new we(1118481)},shininess:{value:30}}]),vertexShader:He.meshphong_vert,fragmentShader:He.meshphong_frag},standard:{uniforms:vn([ue.common,ue.envmap,ue.aomap,ue.lightmap,ue.emissivemap,ue.bumpmap,ue.normalmap,ue.displacementmap,ue.roughnessmap,ue.metalnessmap,ue.fog,ue.lights,{emissive:{value:new we(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:He.meshphysical_vert,fragmentShader:He.meshphysical_frag},toon:{uniforms:vn([ue.common,ue.aomap,ue.lightmap,ue.emissivemap,ue.bumpmap,ue.normalmap,ue.displacementmap,ue.gradientmap,ue.fog,ue.lights,{emissive:{value:new we(0)}}]),vertexShader:He.meshtoon_vert,fragmentShader:He.meshtoon_frag},matcap:{uniforms:vn([ue.common,ue.bumpmap,ue.normalmap,ue.displacementmap,ue.fog,{matcap:{value:null}}]),vertexShader:He.meshmatcap_vert,fragmentShader:He.meshmatcap_frag},points:{uniforms:vn([ue.points,ue.fog]),vertexShader:He.points_vert,fragmentShader:He.points_frag},dashed:{uniforms:vn([ue.common,ue.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:He.linedashed_vert,fragmentShader:He.linedashed_frag},depth:{uniforms:vn([ue.common,ue.displacementmap]),vertexShader:He.depth_vert,fragmentShader:He.depth_frag},normal:{uniforms:vn([ue.common,ue.bumpmap,ue.normalmap,ue.displacementmap,{opacity:{value:1}}]),vertexShader:He.meshnormal_vert,fragmentShader:He.meshnormal_frag},sprite:{uniforms:vn([ue.sprite,ue.fog]),vertexShader:He.sprite_vert,fragmentShader:He.sprite_frag},background:{uniforms:{uvTransform:{value:new Ge},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:He.background_vert,fragmentShader:He.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ge}},vertexShader:He.backgroundCube_vert,fragmentShader:He.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:He.cube_vert,fragmentShader:He.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:He.equirect_vert,fragmentShader:He.equirect_frag},distanceRGBA:{uniforms:vn([ue.common,ue.displacementmap,{referencePosition:{value:new P},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:He.distanceRGBA_vert,fragmentShader:He.distanceRGBA_frag},shadow:{uniforms:vn([ue.lights,ue.fog,{color:{value:new we(0)},opacity:{value:1}}]),vertexShader:He.shadow_vert,fragmentShader:He.shadow_frag}};xi.physical={uniforms:vn([xi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ge},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ge},clearcoatNormalScale:{value:new Le(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ge},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ge},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ge},sheen:{value:0},sheenColor:{value:new we(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ge},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ge},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ge},transmissionSamplerSize:{value:new Le},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ge},attenuationDistance:{value:0},attenuationColor:{value:new we(0)},specularColor:{value:new we(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ge},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ge},anisotropyVector:{value:new Le},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ge}}]),vertexShader:He.meshphysical_vert,fragmentShader:He.meshphysical_frag};var ou={r:0,b:0,g:0},cs=new Ei,YA=new Ue;function jA(n,e,t,i,r,s,o){let a=new we(0),l=s===!0?0:1,c,u,h=null,d=0,p=null;function v(g){let y=g.isScene===!0?g.background:null;return y&&y.isTexture&&(y=(g.backgroundBlurriness>0?t:e).get(y)),y}function _(g){let y=!1,x=v(g);x===null?f(a,l):x&&x.isColor&&(f(x,1),y=!0);let R=n.xr.getEnvironmentBlendMode();R==="additive"?i.buffers.color.setClear(0,0,0,1,o):R==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,o),(n.autoClear||y)&&n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil)}function m(g,y){let x=v(y);x&&(x.isCubeTexture||x.mapping===Ku)?(u===void 0&&(u=new st(new nl(1,1,1),new _n({name:"BackgroundCubeMaterial",uniforms:Io(xi.backgroundCube.uniforms),vertexShader:xi.backgroundCube.vertexShader,fragmentShader:xi.backgroundCube.fragmentShader,side:Xt,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(R,T,b){this.matrixWorld.copyPosition(b.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(u)),cs.copy(y.backgroundRotation),cs.x*=-1,cs.y*=-1,cs.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(cs.y*=-1,cs.z*=-1),u.material.uniforms.envMap.value=x,u.material.uniforms.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(YA.makeRotationFromEuler(cs)),u.material.toneMapped=nt.getTransfer(x.colorSpace)!==mt,(h!==x||d!==x.version||p!==n.toneMapping)&&(u.material.needsUpdate=!0,h=x,d=x.version,p=n.toneMapping),u.layers.enableAll(),g.unshift(u,u.geometry,u.material,0,0,null)):x&&x.isTexture&&(c===void 0&&(c=new st(new Lo(2,2),new _n({name:"BackgroundMaterial",uniforms:Io(xi.background.uniforms),vertexShader:xi.background.vertexShader,fragmentShader:xi.background.fragmentShader,side:Zn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=x,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.toneMapped=nt.getTransfer(x.colorSpace)!==mt,x.matrixAutoUpdate===!0&&x.updateMatrix(),c.material.uniforms.uvTransform.value.copy(x.matrix),(h!==x||d!==x.version||p!==n.toneMapping)&&(c.material.needsUpdate=!0,h=x,d=x.version,p=n.toneMapping),c.layers.enableAll(),g.unshift(c,c.geometry,c.material,0,0,null))}function f(g,y){g.getRGB(ou,Cx(n)),i.buffers.color.setClear(ou.r,ou.g,ou.b,y,o)}return{getClearColor:function(){return a},setClearColor:function(g,y=1){a.set(g),l=y,f(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(g){l=g,f(a,l)},render:_,addToRenderList:m}}function KA(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=d(null),s=r,o=!1;function a(M,L,U,I,H){let Y=!1,q=h(I,U,L);s!==q&&(s=q,c(s.object)),Y=p(M,I,U,H),Y&&v(M,I,U,H),H!==null&&e.update(H,n.ELEMENT_ARRAY_BUFFER),(Y||o)&&(o=!1,x(M,L,U,I),H!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(H).buffer))}function l(){return n.createVertexArray()}function c(M){return n.bindVertexArray(M)}function u(M){return n.deleteVertexArray(M)}function h(M,L,U){let I=U.wireframe===!0,H=i[M.id];H===void 0&&(H={},i[M.id]=H);let Y=H[L.id];Y===void 0&&(Y={},H[L.id]=Y);let q=Y[I];return q===void 0&&(q=d(l()),Y[I]=q),q}function d(M){let L=[],U=[],I=[];for(let H=0;H<t;H++)L[H]=0,U[H]=0,I[H]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:U,attributeDivisors:I,object:M,attributes:{},index:null}}function p(M,L,U,I){let H=s.attributes,Y=L.attributes,q=0,te=U.getAttributes();for(let k in te)if(te[k].location>=0){let Q=H[k],le=Y[k];if(le===void 0&&(k==="instanceMatrix"&&M.instanceMatrix&&(le=M.instanceMatrix),k==="instanceColor"&&M.instanceColor&&(le=M.instanceColor)),Q===void 0||Q.attribute!==le||le&&Q.data!==le.data)return!0;q++}return s.attributesNum!==q||s.index!==I}function v(M,L,U,I){let H={},Y=L.attributes,q=0,te=U.getAttributes();for(let k in te)if(te[k].location>=0){let Q=Y[k];Q===void 0&&(k==="instanceMatrix"&&M.instanceMatrix&&(Q=M.instanceMatrix),k==="instanceColor"&&M.instanceColor&&(Q=M.instanceColor));let le={};le.attribute=Q,Q&&Q.data&&(le.data=Q.data),H[k]=le,q++}s.attributes=H,s.attributesNum=q,s.index=I}function _(){let M=s.newAttributes;for(let L=0,U=M.length;L<U;L++)M[L]=0}function m(M){f(M,0)}function f(M,L){let U=s.newAttributes,I=s.enabledAttributes,H=s.attributeDivisors;U[M]=1,I[M]===0&&(n.enableVertexAttribArray(M),I[M]=1),H[M]!==L&&(n.vertexAttribDivisor(M,L),H[M]=L)}function g(){let M=s.newAttributes,L=s.enabledAttributes;for(let U=0,I=L.length;U<I;U++)L[U]!==M[U]&&(n.disableVertexAttribArray(U),L[U]=0)}function y(M,L,U,I,H,Y,q){q===!0?n.vertexAttribIPointer(M,L,U,H,Y):n.vertexAttribPointer(M,L,U,I,H,Y)}function x(M,L,U,I){_();let H=I.attributes,Y=U.getAttributes(),q=L.defaultAttributeValues;for(let te in Y){let k=Y[te];if(k.location>=0){let $=H[te];if($===void 0&&(te==="instanceMatrix"&&M.instanceMatrix&&($=M.instanceMatrix),te==="instanceColor"&&M.instanceColor&&($=M.instanceColor)),$!==void 0){let Q=$.normalized,le=$.itemSize,be=e.get($);if(be===void 0)continue;let Te=be.buffer,X=be.type,re=be.bytesPerElement,pe=X===n.INT||X===n.UNSIGNED_INT||$.gpuType===gx;if($.isInterleavedBufferAttribute){let oe=$.data,Pe=oe.stride,ke=$.offset;if(oe.isInstancedInterleavedBuffer){for(let F=0;F<k.locationSize;F++)f(k.location+F,oe.meshPerAttribute);M.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=oe.meshPerAttribute*oe.count)}else for(let F=0;F<k.locationSize;F++)m(k.location+F);n.bindBuffer(n.ARRAY_BUFFER,Te);for(let F=0;F<k.locationSize;F++)y(k.location+F,le/k.locationSize,X,Q,Pe*re,(ke+le/k.locationSize*F)*re,pe)}else{if($.isInstancedBufferAttribute){for(let oe=0;oe<k.locationSize;oe++)f(k.location+oe,$.meshPerAttribute);M.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=$.meshPerAttribute*$.count)}else for(let oe=0;oe<k.locationSize;oe++)m(k.location+oe);n.bindBuffer(n.ARRAY_BUFFER,Te);for(let oe=0;oe<k.locationSize;oe++)y(k.location+oe,le/k.locationSize,X,Q,le*re,le/k.locationSize*oe*re,pe)}}else if(q!==void 0){let Q=q[te];if(Q!==void 0)switch(Q.length){case 2:n.vertexAttrib2fv(k.location,Q);break;case 3:n.vertexAttrib3fv(k.location,Q);break;case 4:n.vertexAttrib4fv(k.location,Q);break;default:n.vertexAttrib1fv(k.location,Q)}}}}g()}function R(){C();for(let M in i){let L=i[M];for(let U in L){let I=L[U];for(let H in I)u(I[H].object),delete I[H];delete L[U]}delete i[M]}}function T(M){if(i[M.id]===void 0)return;let L=i[M.id];for(let U in L){let I=L[U];for(let H in I)u(I[H].object),delete I[H];delete L[U]}delete i[M.id]}function b(M){for(let L in i){let U=i[L];if(U[M.id]===void 0)continue;let I=U[M.id];for(let H in I)u(I[H].object),delete I[H];delete U[M.id]}}function C(){E(),o=!0,s!==r&&(s=r,c(s.object))}function E(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:C,resetDefaultState:E,dispose:R,releaseStatesOfGeometry:T,releaseStatesOfProgram:b,initAttributes:_,enableAttribute:m,disableUnusedAttributes:g}}function ZA(n,e,t){let i;function r(c){i=c}function s(c,u){n.drawArrays(i,c,u),t.update(u,i,1)}function o(c,u,h){h!==0&&(n.drawArraysInstanced(i,c,u,h),t.update(u,i,h))}function a(c,u,h){if(h===0)return;let d=e.get("WEBGL_multi_draw");if(d===null)for(let p=0;p<h;p++)this.render(c[p],u[p]);else{d.multiDrawArraysWEBGL(i,c,0,u,0,h);let p=0;for(let v=0;v<h;v++)p+=u[v];t.update(p,i,1)}}function l(c,u,h,d){if(h===0)return;let p=e.get("WEBGL_multi_draw");if(p===null)for(let v=0;v<c.length;v++)o(c[v],u[v],d[v]);else{p.multiDrawArraysInstancedWEBGL(i,c,0,u,0,d,0,h);let v=0;for(let _=0;_<h;_++)v+=u[_];for(let _=0;_<d.length;_++)t.update(v,i,d[_])}}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function $A(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let T=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(T.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(T){return!(T!==hi&&i.convert(T)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(T){let b=T===Zu&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(T!==Nr&&i.convert(T)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&T!==Si&&!b)}function l(T){if(T==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";T="mediump"}return T==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",u=l(c);u!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);let h=t.logarithmicDepthBuffer===!0,d=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),p=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=n.getParameter(n.MAX_TEXTURE_SIZE),_=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),m=n.getParameter(n.MAX_VERTEX_ATTRIBS),f=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),g=n.getParameter(n.MAX_VARYING_VECTORS),y=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),x=p>0,R=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:h,maxTextures:d,maxVertexTextures:p,maxTextureSize:v,maxCubemapSize:_,maxAttributes:m,maxVertexUniforms:f,maxVaryings:g,maxFragmentUniforms:y,vertexTextures:x,maxSamples:R}}function JA(n){let e=this,t=null,i=0,r=!1,s=!1,o=new qi,a=new Ge,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d){let p=h.length!==0||d||i!==0||r;return r=d,i=h.length,p},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,d){t=u(h,d,0)},this.setState=function(h,d,p){let v=h.clippingPlanes,_=h.clipIntersection,m=h.clipShadows,f=n.get(h);if(!r||v===null||v.length===0||s&&!m)s?u(null):c();else{let g=s?0:i,y=g*4,x=f.clippingState||null;l.value=x,x=u(v,d,y,p);for(let R=0;R!==y;++R)x[R]=t[R];f.clippingState=x,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=g}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(h,d,p,v){let _=h!==null?h.length:0,m=null;if(_!==0){if(m=l.value,v!==!0||m===null){let f=p+_*4,g=d.matrixWorldInverse;a.getNormalMatrix(g),(m===null||m.length<f)&&(m=new Float32Array(f));for(let y=0,x=p;y!==_;++y,x+=4)o.copy(h[y]).applyMatrix4(g,a),o.normal.toArray(m,x),m[x+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=_,e.numIntersection=0,m}}function QA(n){let e=new WeakMap;function t(o,a){return a===_p?o.mapping=Ao:a===xp&&(o.mapping=bo),o}function i(o){if(o&&o.isTexture){let a=o.mapping;if(a===_p||a===xp)if(e.has(o)){let l=e.get(o).texture;return t(l,o.mapping)}else{let l=o.image;if(l&&l.height>0){let c=new Ap(l.height);return c.fromEquirectangularTexture(n,o),e.set(o,c),o.addEventListener("dispose",r),t(c.texture,o.mapping)}else return null}}return o}function r(o){let a=o.target;a.removeEventListener("dispose",r);let l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function s(){e=new WeakMap}return{get:i,dispose:s}}var No=class extends Tu{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=i-e,o=i+e,a=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Mo=4,T_=[.125,.215,.35,.446,.526,.582],fs=20,op=new No,A_=new we,ap=null,lp=0,cp=0,up=!1,hs=(1+Math.sqrt(5))/2,mo=1/hs,b_=[new P(-hs,mo,0),new P(hs,mo,0),new P(-mo,0,hs),new P(mo,0,hs),new P(0,hs,-mo),new P(0,hs,mo),new P(-1,1,-1),new P(1,1,-1),new P(-1,1,1),new P(1,1,1)],Do=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,r=100){ap=this._renderer.getRenderTarget(),lp=this._renderer.getActiveCubeFace(),cp=this._renderer.getActiveMipmapLevel(),up=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,i,r,s),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=P_(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=C_(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(ap,lp,cp),this._renderer.xr.enabled=up,e.scissorTest=!1,au(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Ao||e.mapping===bo?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ap=this._renderer.getRenderTarget(),lp=this._renderer.getActiveCubeFace(),cp=this._renderer.getActiveMipmapLevel(),up=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:An,minFilter:An,generateMipmaps:!1,type:Zu,format:hi,colorSpace:jt,depthBuffer:!1},r=R_(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=R_(e,t,i);let{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=eb(s)),this._blurMaterial=tb(s,e,t)}return r}_compileMaterial(e){let t=new st(this._lodPlanes[0],e);this._renderer.compile(t,op)}_sceneToCubeUV(e,t,i,r){let a=new Ft(90,1,t,i),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],u=this._renderer,h=u.autoClear,d=u.toneMapping;u.getClearColor(A_),u.toneMapping=wi,u.autoClear=!1;let p=new qt({name:"PMREM.Background",side:Xt,depthWrite:!1,depthTest:!1}),v=new st(new nl,p),_=!1,m=e.background;m?m.isColor&&(p.color.copy(m),e.background=null,_=!0):(p.color.copy(A_),_=!0);for(let f=0;f<6;f++){let g=f%3;g===0?(a.up.set(0,l[f],0),a.lookAt(c[f],0,0)):g===1?(a.up.set(0,0,l[f]),a.lookAt(0,c[f],0)):(a.up.set(0,l[f],0),a.lookAt(0,0,c[f]));let y=this._cubeSize;au(r,g*y,f>2?y:0,y,y),u.setRenderTarget(r),_&&u.render(v,a),u.render(e,a)}v.geometry.dispose(),v.material.dispose(),u.toneMapping=d,u.autoClear=h,e.background=m}_textureToCubeUV(e,t){let i=this._renderer,r=e.mapping===Ao||e.mapping===bo;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=P_()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=C_());let s=r?this._cubemapMaterial:this._equirectMaterial,o=new st(this._lodPlanes[0],s),a=s.uniforms;a.envMap.value=e;let l=this._cubeSize;au(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,op)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let r=this._lodPlanes.length;for(let s=1;s<r;s++){let o=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),a=b_[(r-s-1)%b_.length];this._blur(e,s-1,s,o,a)}t.autoClear=i}_blur(e,t,i,r,s){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){let l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let u=3,h=new st(this._lodPlanes[r],c),d=c.uniforms,p=this._sizeLods[i]-1,v=isFinite(s)?Math.PI/(2*p):2*Math.PI/(2*fs-1),_=s/v,m=isFinite(s)?1+Math.floor(u*_):fs;m>fs&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${fs}`);let f=[],g=0;for(let b=0;b<fs;++b){let C=b/_,E=Math.exp(-C*C/2);f.push(E),b===0?g+=E:b<m&&(g+=2*E)}for(let b=0;b<f.length;b++)f[b]=f[b]/g;d.envMap.value=e.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a);let{_lodMax:y}=this;d.dTheta.value=v,d.mipInt.value=y-i;let x=this._sizeLods[r],R=3*x*(r>y-Mo?r-y+Mo:0),T=4*(this._cubeSize-x);au(t,R,T,3*x,2*x),l.setRenderTarget(t),l.render(h,op)}};function eb(n){let e=[],t=[],i=[],r=n,s=n-Mo+1+T_.length;for(let o=0;o<s;o++){let a=Math.pow(2,r);t.push(a);let l=1/a;o>n-Mo?l=T_[o-n+Mo-1]:o===0&&(l=0),i.push(l);let c=1/(a-2),u=-c,h=1+c,d=[u,u,h,u,h,h,u,u,h,h,u,h],p=6,v=6,_=3,m=2,f=1,g=new Float32Array(_*v*p),y=new Float32Array(m*v*p),x=new Float32Array(f*v*p);for(let T=0;T<p;T++){let b=T%3*2/3-1,C=T>2?0:-1,E=[b,C,0,b+2/3,C,0,b+2/3,C+1,0,b,C,0,b+2/3,C+1,0,b,C+1,0];g.set(E,_*v*T),y.set(d,m*v*T);let M=[T,T,T,T,T,T];x.set(M,f*v*T)}let R=new Yt;R.setAttribute("position",new Ct(g,_)),R.setAttribute("uv",new Ct(y,m)),R.setAttribute("faceIndex",new Ct(x,f)),e.push(R),r>Mo&&r--}return{lodPlanes:e,sizeLods:t,sigmas:i}}function R_(n,e,t){let i=new Zi(n,e,t);return i.texture.mapping=Ku,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function au(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function tb(n,e,t){let i=new Float32Array(fs),r=new P(0,1,0);return new _n({name:"SphericalGaussianBlur",defines:{n:fs,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:rm(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Lr,depthTest:!1,depthWrite:!1})}function C_(){return new _n({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:rm(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Lr,depthTest:!1,depthWrite:!1})}function P_(){return new _n({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:rm(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Lr,depthTest:!1,depthWrite:!1})}function rm(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function nb(n){let e=new WeakMap,t=null;function i(a){if(a&&a.isTexture){let l=a.mapping,c=l===_p||l===xp,u=l===Ao||l===bo;if(c||u){let h=e.get(a),d=h!==void 0?h.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==d)return t===null&&(t=new Do(n)),h=c?t.fromEquirectangular(a,h):t.fromCubemap(a,h),h.texture.pmremVersion=a.pmremVersion,e.set(a,h),h.texture;if(h!==void 0)return h.texture;{let p=a.image;return c&&p&&p.height>0||u&&p&&r(p)?(t===null&&(t=new Do(n)),h=c?t.fromEquirectangular(a):t.fromCubemap(a),h.texture.pmremVersion=a.pmremVersion,e.set(a,h),a.addEventListener("dispose",s),h.texture):null}}}return a}function r(a){let l=0,c=6;for(let u=0;u<c;u++)a[u]!==void 0&&l++;return l===c}function s(a){let l=a.target;l.removeEventListener("dispose",s);let c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:o}}function ib(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let r=t(i);return r===null&&console.warn("THREE.WebGLRenderer: "+i+" extension not supported."),r}}}function rb(n,e,t,i){let r={},s=new WeakMap;function o(h){let d=h.target;d.index!==null&&e.remove(d.index);for(let v in d.attributes)e.remove(d.attributes[v]);for(let v in d.morphAttributes){let _=d.morphAttributes[v];for(let m=0,f=_.length;m<f;m++)e.remove(_[m])}d.removeEventListener("dispose",o),delete r[d.id];let p=s.get(d);p&&(e.remove(p),s.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(h,d){return r[d.id]===!0||(d.addEventListener("dispose",o),r[d.id]=!0,t.memory.geometries++),d}function l(h){let d=h.attributes;for(let v in d)e.update(d[v],n.ARRAY_BUFFER);let p=h.morphAttributes;for(let v in p){let _=p[v];for(let m=0,f=_.length;m<f;m++)e.update(_[m],n.ARRAY_BUFFER)}}function c(h){let d=[],p=h.index,v=h.attributes.position,_=0;if(p!==null){let g=p.array;_=p.version;for(let y=0,x=g.length;y<x;y+=3){let R=g[y+0],T=g[y+1],b=g[y+2];d.push(R,T,T,b,b,R)}}else if(v!==void 0){let g=v.array;_=v.version;for(let y=0,x=g.length/3-1;y<x;y+=3){let R=y+0,T=y+1,b=y+2;d.push(R,T,T,b,b,R)}}else return;let m=new(Ax(d)?Eu:wu)(d,1);m.version=_;let f=s.get(h);f&&e.remove(f),s.set(h,m)}function u(h){let d=s.get(h);if(d){let p=h.index;p!==null&&d.version<p.version&&c(h)}else c(h);return s.get(h)}return{get:a,update:l,getWireframeAttribute:u}}function sb(n,e,t){let i;function r(d){i=d}let s,o;function a(d){s=d.type,o=d.bytesPerElement}function l(d,p){n.drawElements(i,p,s,d*o),t.update(p,i,1)}function c(d,p,v){v!==0&&(n.drawElementsInstanced(i,p,s,d*o,v),t.update(p,i,v))}function u(d,p,v){if(v===0)return;let _=e.get("WEBGL_multi_draw");if(_===null)for(let m=0;m<v;m++)this.render(d[m]/o,p[m]);else{_.multiDrawElementsWEBGL(i,p,0,s,d,0,v);let m=0;for(let f=0;f<v;f++)m+=p[f];t.update(m,i,1)}}function h(d,p,v,_){if(v===0)return;let m=e.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<d.length;f++)c(d[f]/o,p[f],_[f]);else{m.multiDrawElementsInstancedWEBGL(i,p,0,s,d,0,_,0,v);let f=0;for(let g=0;g<v;g++)f+=p[g];for(let g=0;g<_.length;g++)t.update(f,i,_[g])}}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=u,this.renderMultiDrawInstances=h}function ob(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(s/3);break;case n.LINES:t.lines+=a*(s/2);break;case n.LINE_STRIP:t.lines+=a*(s-1);break;case n.LINE_LOOP:t.lines+=a*s;break;case n.POINTS:t.points+=a*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function ab(n,e,t){let i=new WeakMap,r=new ct;function s(o,a,l){let c=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,h=u!==void 0?u.length:0,d=i.get(a);if(d===void 0||d.count!==h){let E=function(){b.dispose(),i.delete(a),a.removeEventListener("dispose",E)};d!==void 0&&d.texture.dispose();let p=a.morphAttributes.position!==void 0,v=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],f=a.morphAttributes.normal||[],g=a.morphAttributes.color||[],y=0;p===!0&&(y=1),v===!0&&(y=2),_===!0&&(y=3);let x=a.attributes.position.count*y,R=1;x>e.maxTextureSize&&(R=Math.ceil(x/e.maxTextureSize),x=e.maxTextureSize);let T=new Float32Array(x*R*4*h),b=new Su(T,x,R,h);b.type=Si,b.needsUpdate=!0;let C=y*4;for(let M=0;M<h;M++){let L=m[M],U=f[M],I=g[M],H=x*R*4*M;for(let Y=0;Y<L.count;Y++){let q=Y*C;p===!0&&(r.fromBufferAttribute(L,Y),T[H+q+0]=r.x,T[H+q+1]=r.y,T[H+q+2]=r.z,T[H+q+3]=0),v===!0&&(r.fromBufferAttribute(U,Y),T[H+q+4]=r.x,T[H+q+5]=r.y,T[H+q+6]=r.z,T[H+q+7]=0),_===!0&&(r.fromBufferAttribute(I,Y),T[H+q+8]=r.x,T[H+q+9]=r.y,T[H+q+10]=r.z,T[H+q+11]=I.itemSize===4?r.w:1)}}d={count:h,texture:b,size:new Le(x,R)},i.set(a,d),a.addEventListener("dispose",E)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let p=0;for(let _=0;_<c.length;_++)p+=c[_];let v=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(n,"morphTargetBaseInfluence",v),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",d.size)}return{update:s}}function lb(n,e,t,i){let r=new WeakMap;function s(l){let c=i.render.frame,u=l.geometry,h=e.get(l,u);if(r.get(h)!==c&&(e.update(h),r.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),r.get(l)!==c&&(t.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,n.ARRAY_BUFFER),r.set(l,c))),l.isSkinnedMesh){let d=l.skeleton;r.get(d)!==c&&(d.update(),r.set(d,c))}return h}function o(){r=new WeakMap}function a(l){let c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:s,dispose:o}}var bu=class extends Dt{constructor(e,t,i,r,s,o,a,l,c,u){if(u=u!==void 0?u:wo,u!==wo&&u!==Qa)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&u===wo&&(i=Ro),i===void 0&&u===Qa&&(i=dl),super(null,r,s,o,a,l,u,i,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=a!==void 0?a:cn,this.minFilter=l!==void 0?l:cn,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},Ix=new Dt,Lx=new bu(1,1);Lx.compareFunction=Tx;var Nx=new Su,Dx=new Ep,Ux=new Au,I_=[],L_=[],N_=new Float32Array(16),D_=new Float32Array(9),U_=new Float32Array(4);function Vo(n,e,t){let i=n[0];if(i<=0||i>0)return n;let r=e*t,s=I_[r];if(s===void 0&&(s=new Float32Array(r),I_[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function kt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function zt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Qu(n,e){let t=L_[e];t===void 0&&(t=new Int32Array(e),L_[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function cb(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function ub(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(kt(t,e))return;n.uniform2fv(this.addr,e),zt(t,e)}}function hb(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(kt(t,e))return;n.uniform3fv(this.addr,e),zt(t,e)}}function db(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(kt(t,e))return;n.uniform4fv(this.addr,e),zt(t,e)}}function fb(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(kt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),zt(t,e)}else{if(kt(t,i))return;U_.set(i),n.uniformMatrix2fv(this.addr,!1,U_),zt(t,i)}}function pb(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(kt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),zt(t,e)}else{if(kt(t,i))return;D_.set(i),n.uniformMatrix3fv(this.addr,!1,D_),zt(t,i)}}function mb(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(kt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),zt(t,e)}else{if(kt(t,i))return;N_.set(i),n.uniformMatrix4fv(this.addr,!1,N_),zt(t,i)}}function gb(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function vb(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(kt(t,e))return;n.uniform2iv(this.addr,e),zt(t,e)}}function yb(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(kt(t,e))return;n.uniform3iv(this.addr,e),zt(t,e)}}function _b(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(kt(t,e))return;n.uniform4iv(this.addr,e),zt(t,e)}}function xb(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function Mb(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(kt(t,e))return;n.uniform2uiv(this.addr,e),zt(t,e)}}function Sb(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(kt(t,e))return;n.uniform3uiv(this.addr,e),zt(t,e)}}function wb(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(kt(t,e))return;n.uniform4uiv(this.addr,e),zt(t,e)}}function Eb(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s=this.type===n.SAMPLER_2D_SHADOW?Lx:Ix;t.setTexture2D(e||s,r)}function Tb(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||Dx,r)}function Ab(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||Ux,r)}function bb(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||Nx,r)}function Rb(n){switch(n){case 5126:return cb;case 35664:return ub;case 35665:return hb;case 35666:return db;case 35674:return fb;case 35675:return pb;case 35676:return mb;case 5124:case 35670:return gb;case 35667:case 35671:return vb;case 35668:case 35672:return yb;case 35669:case 35673:return _b;case 5125:return xb;case 36294:return Mb;case 36295:return Sb;case 36296:return wb;case 35678:case 36198:case 36298:case 36306:case 35682:return Eb;case 35679:case 36299:case 36307:return Tb;case 35680:case 36300:case 36308:case 36293:return Ab;case 36289:case 36303:case 36311:case 36292:return bb}}function Cb(n,e){n.uniform1fv(this.addr,e)}function Pb(n,e){let t=Vo(e,this.size,2);n.uniform2fv(this.addr,t)}function Ib(n,e){let t=Vo(e,this.size,3);n.uniform3fv(this.addr,t)}function Lb(n,e){let t=Vo(e,this.size,4);n.uniform4fv(this.addr,t)}function Nb(n,e){let t=Vo(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Db(n,e){let t=Vo(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Ub(n,e){let t=Vo(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Ob(n,e){n.uniform1iv(this.addr,e)}function Fb(n,e){n.uniform2iv(this.addr,e)}function kb(n,e){n.uniform3iv(this.addr,e)}function zb(n,e){n.uniform4iv(this.addr,e)}function Bb(n,e){n.uniform1uiv(this.addr,e)}function Vb(n,e){n.uniform2uiv(this.addr,e)}function Hb(n,e){n.uniform3uiv(this.addr,e)}function Gb(n,e){n.uniform4uiv(this.addr,e)}function Wb(n,e,t){let i=this.cache,r=e.length,s=Qu(t,r);kt(i,s)||(n.uniform1iv(this.addr,s),zt(i,s));for(let o=0;o!==r;++o)t.setTexture2D(e[o]||Ix,s[o])}function Xb(n,e,t){let i=this.cache,r=e.length,s=Qu(t,r);kt(i,s)||(n.uniform1iv(this.addr,s),zt(i,s));for(let o=0;o!==r;++o)t.setTexture3D(e[o]||Dx,s[o])}function qb(n,e,t){let i=this.cache,r=e.length,s=Qu(t,r);kt(i,s)||(n.uniform1iv(this.addr,s),zt(i,s));for(let o=0;o!==r;++o)t.setTextureCube(e[o]||Ux,s[o])}function Yb(n,e,t){let i=this.cache,r=e.length,s=Qu(t,r);kt(i,s)||(n.uniform1iv(this.addr,s),zt(i,s));for(let o=0;o!==r;++o)t.setTexture2DArray(e[o]||Nx,s[o])}function jb(n){switch(n){case 5126:return Cb;case 35664:return Pb;case 35665:return Ib;case 35666:return Lb;case 35674:return Nb;case 35675:return Db;case 35676:return Ub;case 5124:case 35670:return Ob;case 35667:case 35671:return Fb;case 35668:case 35672:return kb;case 35669:case 35673:return zb;case 5125:return Bb;case 36294:return Vb;case 36295:return Hb;case 36296:return Gb;case 35678:case 36198:case 36298:case 36306:case 35682:return Wb;case 35679:case 36299:case 36307:return Xb;case 35680:case 36300:case 36308:case 36293:return qb;case 36289:case 36303:case 36311:case 36292:return Yb}}var bp=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Rb(t.type)}},Rp=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=jb(t.type)}},Cp=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let r=this.seq;for(let s=0,o=r.length;s!==o;++s){let a=r[s];a.setValue(e,t[a.id],i)}}},hp=/(\w+)(\])?(\[|\.)?/g;function O_(n,e){n.seq.push(e),n.map[e.id]=e}function Kb(n,e,t){let i=n.name,r=i.length;for(hp.lastIndex=0;;){let s=hp.exec(i),o=hp.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){O_(t,c===void 0?new bp(a,n,e):new Rp(a,n,e));break}else{let h=t.map[a];h===void 0&&(h=new Cp(a),O_(t,h)),t=h}}}var To=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){let s=e.getActiveUniform(t,r),o=e.getUniformLocation(t,s.name);Kb(s,o,this)}}setValue(e,t,i,r){let s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){let r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,o=t.length;s!==o;++s){let a=t[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,r)}}static seqWithValue(e,t){let i=[];for(let r=0,s=e.length;r!==s;++r){let o=e[r];o.id in t&&i.push(o)}return i}};function F_(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var Zb=37297,$b=0;function Jb(n,e){let t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}function Qb(n){let e=nt.getPrimaries(nt.workingColorSpace),t=nt.getPrimaries(n),i;switch(e===t?i="":e===_u&&t===yu?i="LinearDisplayP3ToLinearSRGB":e===yu&&t===_u&&(i="LinearSRGBToLinearDisplayP3"),n){case jt:case Ju:return[i,"LinearTransferOETF"];case wt:case nm:return[i,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",n),[i,"LinearTransferOETF"]}}function k_(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),r=n.getShaderInfoLog(e).trim();if(i&&r==="")return"";let s=/ERROR: 0:(\d+)/.exec(r);if(s){let o=parseInt(s[1]);return t.toUpperCase()+`

`+r+`

`+Jb(n.getShaderSource(e),o)}else return r}function eR(n,e){let t=Qb(e);return`vec4 ${n}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function tR(n,e){let t;switch(e){case tw:t="Linear";break;case nw:t="Reinhard";break;case iw:t="OptimizedCineon";break;case Qp:t="ACESFilmic";break;case sw:t="AgX";break;case ow:t="Neutral";break;case rw:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function nR(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ya).join(`
`)}function iR(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function rR(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=n.getActiveAttrib(e,r),o=s.name,a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),t[o]={type:s.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function Ya(n){return n!==""}function z_(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function B_(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var sR=/^[ \t]*#include +<([\w\d./]+)>/gm;function Pp(n){return n.replace(sR,aR)}var oR=new Map;function aR(n,e){let t=He[e];if(t===void 0){let i=oR.get(e);if(i!==void 0)t=He[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("Can not resolve #include <"+e+">")}return Pp(t)}var lR=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function V_(n){return n.replace(lR,cR)}function cR(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function H_(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function uR(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===dx?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===hl?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===Xi&&(e="SHADOWMAP_TYPE_VSM"),e}function hR(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case Ao:case bo:e="ENVMAP_TYPE_CUBE";break;case Ku:e="ENVMAP_TYPE_CUBE_UV";break}return e}function dR(n){let e="ENVMAP_MODE_REFLECTION";return n.envMap&&n.envMapMode===bo&&(e="ENVMAP_MODE_REFRACTION"),e}function fR(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case fx:e="ENVMAP_BLENDING_MULTIPLY";break;case Q1:e="ENVMAP_BLENDING_MIX";break;case ew:e="ENVMAP_BLENDING_ADD";break}return e}function pR(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function mR(n,e,t,i){let r=n.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,l=uR(t),c=hR(t),u=dR(t),h=fR(t),d=pR(t),p=nR(t),v=iR(s),_=r.createProgram(),m,f,g=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v].filter(Ya).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v].filter(Ya).join(`
`),f.length>0&&(f+=`
`)):(m=[H_(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ya).join(`
`),f=[H_(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,v,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==wi?"#define TONE_MAPPING":"",t.toneMapping!==wi?He.tonemapping_pars_fragment:"",t.toneMapping!==wi?tR("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",He.colorspace_pars_fragment,eR("linearToOutputTexel",t.outputColorSpace),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Ya).join(`
`)),o=Pp(o),o=z_(o,t),o=B_(o,t),a=Pp(a),a=z_(a,t),a=B_(a,t),o=V_(o),a=V_(a),t.isRawShaderMaterial!==!0&&(g=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",t.glslVersion===r_?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===r_?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let y=g+m+o,x=g+f+a,R=F_(r,r.VERTEX_SHADER,y),T=F_(r,r.FRAGMENT_SHADER,x);r.attachShader(_,R),r.attachShader(_,T),t.index0AttributeName!==void 0?r.bindAttribLocation(_,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(_,0,"position"),r.linkProgram(_);function b(L){if(n.debug.checkShaderErrors){let U=r.getProgramInfoLog(_).trim(),I=r.getShaderInfoLog(R).trim(),H=r.getShaderInfoLog(T).trim(),Y=!0,q=!0;if(r.getProgramParameter(_,r.LINK_STATUS)===!1)if(Y=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,_,R,T);else{let te=k_(r,R,"vertex"),k=k_(r,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(_,r.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+U+`
`+te+`
`+k)}else U!==""?console.warn("THREE.WebGLProgram: Program Info Log:",U):(I===""||H==="")&&(q=!1);q&&(L.diagnostics={runnable:Y,programLog:U,vertexShader:{log:I,prefix:m},fragmentShader:{log:H,prefix:f}})}r.deleteShader(R),r.deleteShader(T),C=new To(r,_),E=rR(r,_)}let C;this.getUniforms=function(){return C===void 0&&b(this),C};let E;this.getAttributes=function(){return E===void 0&&b(this),E};let M=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=r.getProgramParameter(_,Zb)),M},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(_),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=$b++,this.cacheKey=e,this.usedTimes=1,this.program=_,this.vertexShader=R,this.fragmentShader=T,this}var gR=0,Ip=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,i=e.fragmentShader,r=this._getShaderStage(t),s=this._getShaderStage(i),o=this._getShaderCacheForMaterial(e);return o.has(r)===!1&&(o.add(r),r.usedTimes++),o.has(s)===!1&&(o.add(s),s.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Lp(e),t.set(e,i)),i}},Lp=class{constructor(e){this.id=gR++,this.code=e,this.usedTimes=0}};function vR(n,e,t,i,r,s,o){let a=new tl,l=new Ip,c=new Set,u=[],h=r.logarithmicDepthBuffer,d=r.vertexTextures,p=r.precision,v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(E){return c.add(E),E===0?"uv":`uv${E}`}function m(E,M,L,U,I){let H=U.fog,Y=I.geometry,q=E.isMeshStandardMaterial?U.environment:null,te=(E.isMeshStandardMaterial?t:e).get(E.envMap||q),k=te&&te.mapping===Ku?te.image.height:null,$=v[E.type];E.precision!==null&&(p=r.getMaxPrecision(E.precision),p!==E.precision&&console.warn("THREE.WebGLProgram.getParameters:",E.precision,"not supported, using",p,"instead."));let Q=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,le=Q!==void 0?Q.length:0,be=0;Y.morphAttributes.position!==void 0&&(be=1),Y.morphAttributes.normal!==void 0&&(be=2),Y.morphAttributes.color!==void 0&&(be=3);let Te,X,re,pe;if($){let We=xi[$];Te=We.vertexShader,X=We.fragmentShader}else Te=E.vertexShader,X=E.fragmentShader,l.update(E),re=l.getVertexShaderID(E),pe=l.getFragmentShaderID(E);let oe=n.getRenderTarget(),Pe=I.isInstancedMesh===!0,ke=I.isBatchedMesh===!0,F=!!E.map,$e=!!E.matcap,ve=!!te,Je=!!E.aoMap,_e=!!E.lightMap,ye=!!E.bumpMap,Oe=!!E.normalMap,Xe=!!E.displacementMap,ut=!!E.emissiveMap,w=!!E.metalnessMap,S=!!E.roughnessMap,D=E.anisotropy>0,G=E.clearcoat>0,J=E.dispersion>0,ee=E.iridescence>0,Ae=E.sheen>0,de=E.transmission>0,he=D&&!!E.anisotropyMap,Ne=G&&!!E.clearcoatMap,se=G&&!!E.clearcoatNormalMap,Me=G&&!!E.clearcoatRoughnessMap,Ye=ee&&!!E.iridescenceMap,Ee=ee&&!!E.iridescenceThicknessMap,me=Ae&&!!E.sheenColorMap,Re=Ae&&!!E.sheenRoughnessMap,Ie=!!E.specularMap,tt=!!E.specularColorMap,Fe=!!E.specularIntensityMap,N=de&&!!E.transmissionMap,K=de&&!!E.thicknessMap,j=!!E.gradientMap,ae=!!E.alphaMap,ce=E.alphaTest>0,De=!!E.alphaHash,Ke=!!E.extensions,it=wi;E.toneMapped&&(oe===null||oe.isXRRenderTarget===!0)&&(it=n.toneMapping);let gt={shaderID:$,shaderType:E.type,shaderName:E.name,vertexShader:Te,fragmentShader:X,defines:E.defines,customVertexShaderID:re,customFragmentShaderID:pe,isRawShaderMaterial:E.isRawShaderMaterial===!0,glslVersion:E.glslVersion,precision:p,batching:ke,instancing:Pe,instancingColor:Pe&&I.instanceColor!==null,instancingMorph:Pe&&I.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:oe===null?n.outputColorSpace:oe.isXRRenderTarget===!0?oe.texture.colorSpace:jt,alphaToCoverage:!!E.alphaToCoverage,map:F,matcap:$e,envMap:ve,envMapMode:ve&&te.mapping,envMapCubeUVHeight:k,aoMap:Je,lightMap:_e,bumpMap:ye,normalMap:Oe,displacementMap:d&&Xe,emissiveMap:ut,normalMapObjectSpace:Oe&&E.normalMapType===ww,normalMapTangentSpace:Oe&&E.normalMapType===Ex,metalnessMap:w,roughnessMap:S,anisotropy:D,anisotropyMap:he,clearcoat:G,clearcoatMap:Ne,clearcoatNormalMap:se,clearcoatRoughnessMap:Me,dispersion:J,iridescence:ee,iridescenceMap:Ye,iridescenceThicknessMap:Ee,sheen:Ae,sheenColorMap:me,sheenRoughnessMap:Re,specularMap:Ie,specularColorMap:tt,specularIntensityMap:Fe,transmission:de,transmissionMap:N,thicknessMap:K,gradientMap:j,opaque:E.transparent===!1&&E.blending===So&&E.alphaToCoverage===!1,alphaMap:ae,alphaTest:ce,alphaHash:De,combine:E.combine,mapUv:F&&_(E.map.channel),aoMapUv:Je&&_(E.aoMap.channel),lightMapUv:_e&&_(E.lightMap.channel),bumpMapUv:ye&&_(E.bumpMap.channel),normalMapUv:Oe&&_(E.normalMap.channel),displacementMapUv:Xe&&_(E.displacementMap.channel),emissiveMapUv:ut&&_(E.emissiveMap.channel),metalnessMapUv:w&&_(E.metalnessMap.channel),roughnessMapUv:S&&_(E.roughnessMap.channel),anisotropyMapUv:he&&_(E.anisotropyMap.channel),clearcoatMapUv:Ne&&_(E.clearcoatMap.channel),clearcoatNormalMapUv:se&&_(E.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Me&&_(E.clearcoatRoughnessMap.channel),iridescenceMapUv:Ye&&_(E.iridescenceMap.channel),iridescenceThicknessMapUv:Ee&&_(E.iridescenceThicknessMap.channel),sheenColorMapUv:me&&_(E.sheenColorMap.channel),sheenRoughnessMapUv:Re&&_(E.sheenRoughnessMap.channel),specularMapUv:Ie&&_(E.specularMap.channel),specularColorMapUv:tt&&_(E.specularColorMap.channel),specularIntensityMapUv:Fe&&_(E.specularIntensityMap.channel),transmissionMapUv:N&&_(E.transmissionMap.channel),thicknessMapUv:K&&_(E.thicknessMap.channel),alphaMapUv:ae&&_(E.alphaMap.channel),vertexTangents:!!Y.attributes.tangent&&(Oe||D),vertexColors:E.vertexColors,vertexAlphas:E.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,pointsUvs:I.isPoints===!0&&!!Y.attributes.uv&&(F||ae),fog:!!H,useFog:E.fog===!0,fogExp2:!!H&&H.isFogExp2,flatShading:E.flatShading===!0,sizeAttenuation:E.sizeAttenuation===!0,logarithmicDepthBuffer:h,skinning:I.isSkinnedMesh===!0,morphTargets:Y.morphAttributes.position!==void 0,morphNormals:Y.morphAttributes.normal!==void 0,morphColors:Y.morphAttributes.color!==void 0,morphTargetsCount:le,morphTextureStride:be,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:E.dithering,shadowMapEnabled:n.shadowMap.enabled&&L.length>0,shadowMapType:n.shadowMap.type,toneMapping:it,useLegacyLights:n._useLegacyLights,decodeVideoTexture:F&&E.map.isVideoTexture===!0&&nt.getTransfer(E.map.colorSpace)===mt,premultipliedAlpha:E.premultipliedAlpha,doubleSided:E.side===yn,flipSided:E.side===Xt,useDepthPacking:E.depthPacking>=0,depthPacking:E.depthPacking||0,index0AttributeName:E.index0AttributeName,extensionClipCullDistance:Ke&&E.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:Ke&&E.extensions.multiDraw===!0&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:E.customProgramCacheKey()};return gt.vertexUv1s=c.has(1),gt.vertexUv2s=c.has(2),gt.vertexUv3s=c.has(3),c.clear(),gt}function f(E){let M=[];if(E.shaderID?M.push(E.shaderID):(M.push(E.customVertexShaderID),M.push(E.customFragmentShaderID)),E.defines!==void 0)for(let L in E.defines)M.push(L),M.push(E.defines[L]);return E.isRawShaderMaterial===!1&&(g(M,E),y(M,E),M.push(n.outputColorSpace)),M.push(E.customProgramCacheKey),M.join()}function g(E,M){E.push(M.precision),E.push(M.outputColorSpace),E.push(M.envMapMode),E.push(M.envMapCubeUVHeight),E.push(M.mapUv),E.push(M.alphaMapUv),E.push(M.lightMapUv),E.push(M.aoMapUv),E.push(M.bumpMapUv),E.push(M.normalMapUv),E.push(M.displacementMapUv),E.push(M.emissiveMapUv),E.push(M.metalnessMapUv),E.push(M.roughnessMapUv),E.push(M.anisotropyMapUv),E.push(M.clearcoatMapUv),E.push(M.clearcoatNormalMapUv),E.push(M.clearcoatRoughnessMapUv),E.push(M.iridescenceMapUv),E.push(M.iridescenceThicknessMapUv),E.push(M.sheenColorMapUv),E.push(M.sheenRoughnessMapUv),E.push(M.specularMapUv),E.push(M.specularColorMapUv),E.push(M.specularIntensityMapUv),E.push(M.transmissionMapUv),E.push(M.thicknessMapUv),E.push(M.combine),E.push(M.fogExp2),E.push(M.sizeAttenuation),E.push(M.morphTargetsCount),E.push(M.morphAttributeCount),E.push(M.numDirLights),E.push(M.numPointLights),E.push(M.numSpotLights),E.push(M.numSpotLightMaps),E.push(M.numHemiLights),E.push(M.numRectAreaLights),E.push(M.numDirLightShadows),E.push(M.numPointLightShadows),E.push(M.numSpotLightShadows),E.push(M.numSpotLightShadowsWithMaps),E.push(M.numLightProbes),E.push(M.shadowMapType),E.push(M.toneMapping),E.push(M.numClippingPlanes),E.push(M.numClipIntersection),E.push(M.depthPacking)}function y(E,M){a.disableAll(),M.supportsVertexTextures&&a.enable(0),M.instancing&&a.enable(1),M.instancingColor&&a.enable(2),M.instancingMorph&&a.enable(3),M.matcap&&a.enable(4),M.envMap&&a.enable(5),M.normalMapObjectSpace&&a.enable(6),M.normalMapTangentSpace&&a.enable(7),M.clearcoat&&a.enable(8),M.iridescence&&a.enable(9),M.alphaTest&&a.enable(10),M.vertexColors&&a.enable(11),M.vertexAlphas&&a.enable(12),M.vertexUv1s&&a.enable(13),M.vertexUv2s&&a.enable(14),M.vertexUv3s&&a.enable(15),M.vertexTangents&&a.enable(16),M.anisotropy&&a.enable(17),M.alphaHash&&a.enable(18),M.batching&&a.enable(19),M.dispersion&&a.enable(20),E.push(a.mask),a.disableAll(),M.fog&&a.enable(0),M.useFog&&a.enable(1),M.flatShading&&a.enable(2),M.logarithmicDepthBuffer&&a.enable(3),M.skinning&&a.enable(4),M.morphTargets&&a.enable(5),M.morphNormals&&a.enable(6),M.morphColors&&a.enable(7),M.premultipliedAlpha&&a.enable(8),M.shadowMapEnabled&&a.enable(9),M.useLegacyLights&&a.enable(10),M.doubleSided&&a.enable(11),M.flipSided&&a.enable(12),M.useDepthPacking&&a.enable(13),M.dithering&&a.enable(14),M.transmission&&a.enable(15),M.sheen&&a.enable(16),M.opaque&&a.enable(17),M.pointsUvs&&a.enable(18),M.decodeVideoTexture&&a.enable(19),M.alphaToCoverage&&a.enable(20),E.push(a.mask)}function x(E){let M=v[E.type],L;if(M){let U=xi[M];L=lE.clone(U.uniforms)}else L=E.uniforms;return L}function R(E,M){let L;for(let U=0,I=u.length;U<I;U++){let H=u[U];if(H.cacheKey===M){L=H,++L.usedTimes;break}}return L===void 0&&(L=new mR(n,M,E,s),u.push(L)),L}function T(E){if(--E.usedTimes===0){let M=u.indexOf(E);u[M]=u[u.length-1],u.pop(),E.destroy()}}function b(E){l.remove(E)}function C(){l.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:x,acquireProgram:R,releaseProgram:T,releaseShaderCache:b,programs:u,dispose:C}}function yR(){let n=new WeakMap;function e(s){let o=n.get(s);return o===void 0&&(o={},n.set(s,o)),o}function t(s){n.delete(s)}function i(s,o,a){n.get(s)[o]=a}function r(){n=new WeakMap}return{get:e,remove:t,update:i,dispose:r}}function _R(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function G_(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function W_(){let n=[],e=0,t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function o(h,d,p,v,_,m){let f=n[e];return f===void 0?(f={id:h.id,object:h,geometry:d,material:p,groupOrder:v,renderOrder:h.renderOrder,z:_,group:m},n[e]=f):(f.id=h.id,f.object=h,f.geometry=d,f.material=p,f.groupOrder=v,f.renderOrder=h.renderOrder,f.z=_,f.group=m),e++,f}function a(h,d,p,v,_,m){let f=o(h,d,p,v,_,m);p.transmission>0?i.push(f):p.transparent===!0?r.push(f):t.push(f)}function l(h,d,p,v,_,m){let f=o(h,d,p,v,_,m);p.transmission>0?i.unshift(f):p.transparent===!0?r.unshift(f):t.unshift(f)}function c(h,d){t.length>1&&t.sort(h||_R),i.length>1&&i.sort(d||G_),r.length>1&&r.sort(d||G_)}function u(){for(let h=e,d=n.length;h<d;h++){let p=n[h];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:a,unshift:l,finish:u,sort:c}}function xR(){let n=new WeakMap;function e(i,r){let s=n.get(i),o;return s===void 0?(o=new W_,n.set(i,[o])):r>=s.length?(o=new W_,s.push(o)):o=s[r],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function MR(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new P,color:new we};break;case"SpotLight":t={position:new P,direction:new P,color:new we,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new P,color:new we,distance:0,decay:0};break;case"HemisphereLight":t={direction:new P,skyColor:new we,groundColor:new we};break;case"RectAreaLight":t={color:new we,position:new P,halfWidth:new P,halfHeight:new P};break}return n[e.id]=t,t}}}function SR(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"SpotLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"PointLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var wR=0;function ER(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function TR(n){let e=new MR,t=SR(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new P);let r=new P,s=new Ue,o=new Ue;function a(c,u){let h=0,d=0,p=0;for(let L=0;L<9;L++)i.probe[L].set(0,0,0);let v=0,_=0,m=0,f=0,g=0,y=0,x=0,R=0,T=0,b=0,C=0;c.sort(ER);let E=u===!0?Math.PI:1;for(let L=0,U=c.length;L<U;L++){let I=c[L],H=I.color,Y=I.intensity,q=I.distance,te=I.shadow&&I.shadow.map?I.shadow.map.texture:null;if(I.isAmbientLight)h+=H.r*Y*E,d+=H.g*Y*E,p+=H.b*Y*E;else if(I.isLightProbe){for(let k=0;k<9;k++)i.probe[k].addScaledVector(I.sh.coefficients[k],Y);C++}else if(I.isDirectionalLight){let k=e.get(I);if(k.color.copy(I.color).multiplyScalar(I.intensity*E),I.castShadow){let $=I.shadow,Q=t.get(I);Q.shadowBias=$.bias,Q.shadowNormalBias=$.normalBias,Q.shadowRadius=$.radius,Q.shadowMapSize=$.mapSize,i.directionalShadow[v]=Q,i.directionalShadowMap[v]=te,i.directionalShadowMatrix[v]=I.shadow.matrix,y++}i.directional[v]=k,v++}else if(I.isSpotLight){let k=e.get(I);k.position.setFromMatrixPosition(I.matrixWorld),k.color.copy(H).multiplyScalar(Y*E),k.distance=q,k.coneCos=Math.cos(I.angle),k.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),k.decay=I.decay,i.spot[m]=k;let $=I.shadow;if(I.map&&(i.spotLightMap[T]=I.map,T++,$.updateMatrices(I),I.castShadow&&b++),i.spotLightMatrix[m]=$.matrix,I.castShadow){let Q=t.get(I);Q.shadowBias=$.bias,Q.shadowNormalBias=$.normalBias,Q.shadowRadius=$.radius,Q.shadowMapSize=$.mapSize,i.spotShadow[m]=Q,i.spotShadowMap[m]=te,R++}m++}else if(I.isRectAreaLight){let k=e.get(I);k.color.copy(H).multiplyScalar(Y),k.halfWidth.set(I.width*.5,0,0),k.halfHeight.set(0,I.height*.5,0),i.rectArea[f]=k,f++}else if(I.isPointLight){let k=e.get(I);if(k.color.copy(I.color).multiplyScalar(I.intensity*E),k.distance=I.distance,k.decay=I.decay,I.castShadow){let $=I.shadow,Q=t.get(I);Q.shadowBias=$.bias,Q.shadowNormalBias=$.normalBias,Q.shadowRadius=$.radius,Q.shadowMapSize=$.mapSize,Q.shadowCameraNear=$.camera.near,Q.shadowCameraFar=$.camera.far,i.pointShadow[_]=Q,i.pointShadowMap[_]=te,i.pointShadowMatrix[_]=I.shadow.matrix,x++}i.point[_]=k,_++}else if(I.isHemisphereLight){let k=e.get(I);k.skyColor.copy(I.color).multiplyScalar(Y*E),k.groundColor.copy(I.groundColor).multiplyScalar(Y*E),i.hemi[g]=k,g++}}f>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ue.LTC_FLOAT_1,i.rectAreaLTC2=ue.LTC_FLOAT_2):(i.rectAreaLTC1=ue.LTC_HALF_1,i.rectAreaLTC2=ue.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=d,i.ambient[2]=p;let M=i.hash;(M.directionalLength!==v||M.pointLength!==_||M.spotLength!==m||M.rectAreaLength!==f||M.hemiLength!==g||M.numDirectionalShadows!==y||M.numPointShadows!==x||M.numSpotShadows!==R||M.numSpotMaps!==T||M.numLightProbes!==C)&&(i.directional.length=v,i.spot.length=m,i.rectArea.length=f,i.point.length=_,i.hemi.length=g,i.directionalShadow.length=y,i.directionalShadowMap.length=y,i.pointShadow.length=x,i.pointShadowMap.length=x,i.spotShadow.length=R,i.spotShadowMap.length=R,i.directionalShadowMatrix.length=y,i.pointShadowMatrix.length=x,i.spotLightMatrix.length=R+T-b,i.spotLightMap.length=T,i.numSpotLightShadowsWithMaps=b,i.numLightProbes=C,M.directionalLength=v,M.pointLength=_,M.spotLength=m,M.rectAreaLength=f,M.hemiLength=g,M.numDirectionalShadows=y,M.numPointShadows=x,M.numSpotShadows=R,M.numSpotMaps=T,M.numLightProbes=C,i.version=wR++)}function l(c,u){let h=0,d=0,p=0,v=0,_=0,m=u.matrixWorldInverse;for(let f=0,g=c.length;f<g;f++){let y=c[f];if(y.isDirectionalLight){let x=i.directional[h];x.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(m),h++}else if(y.isSpotLight){let x=i.spot[p];x.position.setFromMatrixPosition(y.matrixWorld),x.position.applyMatrix4(m),x.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(m),p++}else if(y.isRectAreaLight){let x=i.rectArea[v];x.position.setFromMatrixPosition(y.matrixWorld),x.position.applyMatrix4(m),o.identity(),s.copy(y.matrixWorld),s.premultiply(m),o.extractRotation(s),x.halfWidth.set(y.width*.5,0,0),x.halfHeight.set(0,y.height*.5,0),x.halfWidth.applyMatrix4(o),x.halfHeight.applyMatrix4(o),v++}else if(y.isPointLight){let x=i.point[d];x.position.setFromMatrixPosition(y.matrixWorld),x.position.applyMatrix4(m),d++}else if(y.isHemisphereLight){let x=i.hemi[_];x.direction.setFromMatrixPosition(y.matrixWorld),x.direction.transformDirection(m),_++}}}return{setup:a,setupView:l,state:i}}function X_(n){let e=new TR(n),t=[],i=[];function r(u){c.camera=u,t.length=0,i.length=0}function s(u){t.push(u)}function o(u){i.push(u)}function a(u){e.setup(t,u)}function l(u){e.setupView(t,u)}let c={lightsArray:t,shadowsArray:i,camera:null,lights:e,transmissionRenderTarget:{}};return{init:r,state:c,setupLights:a,setupLightsView:l,pushLight:s,pushShadow:o}}function AR(n){let e=new WeakMap;function t(r,s=0){let o=e.get(r),a;return o===void 0?(a=new X_(n),e.set(r,[a])):s>=o.length?(a=new X_(n),o.push(a)):a=o[s],a}function i(){e=new WeakMap}return{get:t,dispose:i}}var Np=class extends zn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Mw,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Dp=class extends zn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}},bR=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,RR=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function CR(n,e,t){let i=new il,r=new Le,s=new Le,o=new ct,a=new Np({depthPacking:Sw}),l=new Dp,c={},u=t.maxTextureSize,h={[Zn]:Xt,[Xt]:Zn,[yn]:yn},d=new _n({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Le},radius:{value:4}},vertexShader:bR,fragmentShader:RR}),p=d.clone();p.defines.HORIZONTAL_PASS=1;let v=new Yt;v.setAttribute("position",new Ct(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new st(v,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=dx;let f=this.type;this.render=function(T,b,C){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;let E=n.getRenderTarget(),M=n.getActiveCubeFace(),L=n.getActiveMipmapLevel(),U=n.state;U.setBlending(Lr),U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let I=f!==Xi&&this.type===Xi,H=f===Xi&&this.type!==Xi;for(let Y=0,q=T.length;Y<q;Y++){let te=T[Y],k=te.shadow;if(k===void 0){console.warn("THREE.WebGLShadowMap:",te,"has no shadow.");continue}if(k.autoUpdate===!1&&k.needsUpdate===!1)continue;r.copy(k.mapSize);let $=k.getFrameExtents();if(r.multiply($),s.copy(k.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/$.x),r.x=s.x*$.x,k.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/$.y),r.y=s.y*$.y,k.mapSize.y=s.y)),k.map===null||I===!0||H===!0){let le=this.type!==Xi?{minFilter:cn,magFilter:cn}:{};k.map!==null&&k.map.dispose(),k.map=new Zi(r.x,r.y,le),k.map.texture.name=te.name+".shadowMap",k.camera.updateProjectionMatrix()}n.setRenderTarget(k.map),n.clear();let Q=k.getViewportCount();for(let le=0;le<Q;le++){let be=k.getViewport(le);o.set(s.x*be.x,s.y*be.y,s.x*be.z,s.y*be.w),U.viewport(o),k.updateMatrices(te,le),i=k.getFrustum(),x(b,C,k.camera,te,this.type)}k.isPointLightShadow!==!0&&this.type===Xi&&g(k,C),k.needsUpdate=!1}f=this.type,m.needsUpdate=!1,n.setRenderTarget(E,M,L)};function g(T,b){let C=e.update(_);d.defines.VSM_SAMPLES!==T.blurSamples&&(d.defines.VSM_SAMPLES=T.blurSamples,p.defines.VSM_SAMPLES=T.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new Zi(r.x,r.y)),d.uniforms.shadow_pass.value=T.map.texture,d.uniforms.resolution.value=T.mapSize,d.uniforms.radius.value=T.radius,n.setRenderTarget(T.mapPass),n.clear(),n.renderBufferDirect(b,null,C,d,_,null),p.uniforms.shadow_pass.value=T.mapPass.texture,p.uniforms.resolution.value=T.mapSize,p.uniforms.radius.value=T.radius,n.setRenderTarget(T.map),n.clear(),n.renderBufferDirect(b,null,C,p,_,null)}function y(T,b,C,E){let M=null,L=C.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(L!==void 0)M=L;else if(M=C.isPointLight===!0?l:a,n.localClippingEnabled&&b.clipShadows===!0&&Array.isArray(b.clippingPlanes)&&b.clippingPlanes.length!==0||b.displacementMap&&b.displacementScale!==0||b.alphaMap&&b.alphaTest>0||b.map&&b.alphaTest>0){let U=M.uuid,I=b.uuid,H=c[U];H===void 0&&(H={},c[U]=H);let Y=H[I];Y===void 0&&(Y=M.clone(),H[I]=Y,b.addEventListener("dispose",R)),M=Y}if(M.visible=b.visible,M.wireframe=b.wireframe,E===Xi?M.side=b.shadowSide!==null?b.shadowSide:b.side:M.side=b.shadowSide!==null?b.shadowSide:h[b.side],M.alphaMap=b.alphaMap,M.alphaTest=b.alphaTest,M.map=b.map,M.clipShadows=b.clipShadows,M.clippingPlanes=b.clippingPlanes,M.clipIntersection=b.clipIntersection,M.displacementMap=b.displacementMap,M.displacementScale=b.displacementScale,M.displacementBias=b.displacementBias,M.wireframeLinewidth=b.wireframeLinewidth,M.linewidth=b.linewidth,C.isPointLight===!0&&M.isMeshDistanceMaterial===!0){let U=n.properties.get(M);U.light=C}return M}function x(T,b,C,E,M){if(T.visible===!1)return;if(T.layers.test(b.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&M===Xi)&&(!T.frustumCulled||i.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(C.matrixWorldInverse,T.matrixWorld);let I=e.update(T),H=T.material;if(Array.isArray(H)){let Y=I.groups;for(let q=0,te=Y.length;q<te;q++){let k=Y[q],$=H[k.materialIndex];if($&&$.visible){let Q=y(T,$,E,M);T.onBeforeShadow(n,T,b,C,I,Q,k),n.renderBufferDirect(C,null,I,Q,T,k),T.onAfterShadow(n,T,b,C,I,Q,k)}}}else if(H.visible){let Y=y(T,H,E,M);T.onBeforeShadow(n,T,b,C,I,Y,null),n.renderBufferDirect(C,null,I,Y,T,null),T.onAfterShadow(n,T,b,C,I,Y,null)}}let U=T.children;for(let I=0,H=U.length;I<H;I++)x(U[I],b,C,E,M)}function R(T){T.target.removeEventListener("dispose",R);for(let C in c){let E=c[C],M=T.target.uuid;M in E&&(E[M].dispose(),delete E[M])}}}function PR(n){function e(){let N=!1,K=new ct,j=null,ae=new ct(0,0,0,0);return{setMask:function(ce){j!==ce&&!N&&(n.colorMask(ce,ce,ce,ce),j=ce)},setLocked:function(ce){N=ce},setClear:function(ce,De,Ke,it,gt){gt===!0&&(ce*=it,De*=it,Ke*=it),K.set(ce,De,Ke,it),ae.equals(K)===!1&&(n.clearColor(ce,De,Ke,it),ae.copy(K))},reset:function(){N=!1,j=null,ae.set(-1,0,0,0)}}}function t(){let N=!1,K=null,j=null,ae=null;return{setTest:function(ce){ce?pe(n.DEPTH_TEST):oe(n.DEPTH_TEST)},setMask:function(ce){K!==ce&&!N&&(n.depthMask(ce),K=ce)},setFunc:function(ce){if(j!==ce){switch(ce){case q1:n.depthFunc(n.NEVER);break;case Y1:n.depthFunc(n.ALWAYS);break;case j1:n.depthFunc(n.LESS);break;case mu:n.depthFunc(n.LEQUAL);break;case K1:n.depthFunc(n.EQUAL);break;case Z1:n.depthFunc(n.GEQUAL);break;case $1:n.depthFunc(n.GREATER);break;case J1:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}j=ce}},setLocked:function(ce){N=ce},setClear:function(ce){ae!==ce&&(n.clearDepth(ce),ae=ce)},reset:function(){N=!1,K=null,j=null,ae=null}}}function i(){let N=!1,K=null,j=null,ae=null,ce=null,De=null,Ke=null,it=null,gt=null;return{setTest:function(We){N||(We?pe(n.STENCIL_TEST):oe(n.STENCIL_TEST))},setMask:function(We){K!==We&&!N&&(n.stencilMask(We),K=We)},setFunc:function(We,Vt,vt){(j!==We||ae!==Vt||ce!==vt)&&(n.stencilFunc(We,Vt,vt),j=We,ae=Vt,ce=vt)},setOp:function(We,Vt,vt){(De!==We||Ke!==Vt||it!==vt)&&(n.stencilOp(We,Vt,vt),De=We,Ke=Vt,it=vt)},setLocked:function(We){N=We},setClear:function(We){gt!==We&&(n.clearStencil(We),gt=We)},reset:function(){N=!1,K=null,j=null,ae=null,ce=null,De=null,Ke=null,it=null,gt=null}}}let r=new e,s=new t,o=new i,a=new WeakMap,l=new WeakMap,c={},u={},h=new WeakMap,d=[],p=null,v=!1,_=null,m=null,f=null,g=null,y=null,x=null,R=null,T=new we(0,0,0),b=0,C=!1,E=null,M=null,L=null,U=null,I=null,H=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),Y=!1,q=0,te=n.getParameter(n.VERSION);te.indexOf("WebGL")!==-1?(q=parseFloat(/^WebGL (\d)/.exec(te)[1]),Y=q>=1):te.indexOf("OpenGL ES")!==-1&&(q=parseFloat(/^OpenGL ES (\d)/.exec(te)[1]),Y=q>=2);let k=null,$={},Q=n.getParameter(n.SCISSOR_BOX),le=n.getParameter(n.VIEWPORT),be=new ct().fromArray(Q),Te=new ct().fromArray(le);function X(N,K,j,ae){let ce=new Uint8Array(4),De=n.createTexture();n.bindTexture(N,De),n.texParameteri(N,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(N,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Ke=0;Ke<j;Ke++)N===n.TEXTURE_3D||N===n.TEXTURE_2D_ARRAY?n.texImage3D(K,0,n.RGBA,1,1,ae,0,n.RGBA,n.UNSIGNED_BYTE,ce):n.texImage2D(K+Ke,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ce);return De}let re={};re[n.TEXTURE_2D]=X(n.TEXTURE_2D,n.TEXTURE_2D,1),re[n.TEXTURE_CUBE_MAP]=X(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),re[n.TEXTURE_2D_ARRAY]=X(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),re[n.TEXTURE_3D]=X(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),s.setClear(1),o.setClear(0),pe(n.DEPTH_TEST),s.setFunc(mu),ye(!1),Oe(Ay),pe(n.CULL_FACE),Je(Lr);function pe(N){c[N]!==!0&&(n.enable(N),c[N]=!0)}function oe(N){c[N]!==!1&&(n.disable(N),c[N]=!1)}function Pe(N,K){return u[N]!==K?(n.bindFramebuffer(N,K),u[N]=K,N===n.DRAW_FRAMEBUFFER&&(u[n.FRAMEBUFFER]=K),N===n.FRAMEBUFFER&&(u[n.DRAW_FRAMEBUFFER]=K),!0):!1}function ke(N,K){let j=d,ae=!1;if(N){j=h.get(K),j===void 0&&(j=[],h.set(K,j));let ce=N.textures;if(j.length!==ce.length||j[0]!==n.COLOR_ATTACHMENT0){for(let De=0,Ke=ce.length;De<Ke;De++)j[De]=n.COLOR_ATTACHMENT0+De;j.length=ce.length,ae=!0}}else j[0]!==n.BACK&&(j[0]=n.BACK,ae=!0);ae&&n.drawBuffers(j)}function F(N){return p!==N?(n.useProgram(N),p=N,!0):!1}let $e={[ds]:n.FUNC_ADD,[C1]:n.FUNC_SUBTRACT,[P1]:n.FUNC_REVERSE_SUBTRACT};$e[I1]=n.MIN,$e[L1]=n.MAX;let ve={[N1]:n.ZERO,[D1]:n.ONE,[U1]:n.SRC_COLOR,[vp]:n.SRC_ALPHA,[V1]:n.SRC_ALPHA_SATURATE,[z1]:n.DST_COLOR,[F1]:n.DST_ALPHA,[O1]:n.ONE_MINUS_SRC_COLOR,[yp]:n.ONE_MINUS_SRC_ALPHA,[B1]:n.ONE_MINUS_DST_COLOR,[k1]:n.ONE_MINUS_DST_ALPHA,[H1]:n.CONSTANT_COLOR,[G1]:n.ONE_MINUS_CONSTANT_COLOR,[W1]:n.CONSTANT_ALPHA,[X1]:n.ONE_MINUS_CONSTANT_ALPHA};function Je(N,K,j,ae,ce,De,Ke,it,gt,We){if(N===Lr){v===!0&&(oe(n.BLEND),v=!1);return}if(v===!1&&(pe(n.BLEND),v=!0),N!==R1){if(N!==_||We!==C){if((m!==ds||y!==ds)&&(n.blendEquation(n.FUNC_ADD),m=ds,y=ds),We)switch(N){case So:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case by:n.blendFunc(n.ONE,n.ONE);break;case Ry:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Cy:n.blendFuncSeparate(n.ZERO,n.SRC_COLOR,n.ZERO,n.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",N);break}else switch(N){case So:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case by:n.blendFunc(n.SRC_ALPHA,n.ONE);break;case Ry:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Cy:n.blendFunc(n.ZERO,n.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",N);break}f=null,g=null,x=null,R=null,T.set(0,0,0),b=0,_=N,C=We}return}ce=ce||K,De=De||j,Ke=Ke||ae,(K!==m||ce!==y)&&(n.blendEquationSeparate($e[K],$e[ce]),m=K,y=ce),(j!==f||ae!==g||De!==x||Ke!==R)&&(n.blendFuncSeparate(ve[j],ve[ae],ve[De],ve[Ke]),f=j,g=ae,x=De,R=Ke),(it.equals(T)===!1||gt!==b)&&(n.blendColor(it.r,it.g,it.b,gt),T.copy(it),b=gt),_=N,C=!1}function _e(N,K){N.side===yn?oe(n.CULL_FACE):pe(n.CULL_FACE);let j=N.side===Xt;K&&(j=!j),ye(j),N.blending===So&&N.transparent===!1?Je(Lr):Je(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),s.setFunc(N.depthFunc),s.setTest(N.depthTest),s.setMask(N.depthWrite),r.setMask(N.colorWrite);let ae=N.stencilWrite;o.setTest(ae),ae&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),ut(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?pe(n.SAMPLE_ALPHA_TO_COVERAGE):oe(n.SAMPLE_ALPHA_TO_COVERAGE)}function ye(N){E!==N&&(N?n.frontFace(n.CW):n.frontFace(n.CCW),E=N)}function Oe(N){N!==A1?(pe(n.CULL_FACE),N!==M&&(N===Ay?n.cullFace(n.BACK):N===b1?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):oe(n.CULL_FACE),M=N}function Xe(N){N!==L&&(Y&&n.lineWidth(N),L=N)}function ut(N,K,j){N?(pe(n.POLYGON_OFFSET_FILL),(U!==K||I!==j)&&(n.polygonOffset(K,j),U=K,I=j)):oe(n.POLYGON_OFFSET_FILL)}function w(N){N?pe(n.SCISSOR_TEST):oe(n.SCISSOR_TEST)}function S(N){N===void 0&&(N=n.TEXTURE0+H-1),k!==N&&(n.activeTexture(N),k=N)}function D(N,K,j){j===void 0&&(k===null?j=n.TEXTURE0+H-1:j=k);let ae=$[j];ae===void 0&&(ae={type:void 0,texture:void 0},$[j]=ae),(ae.type!==N||ae.texture!==K)&&(k!==j&&(n.activeTexture(j),k=j),n.bindTexture(N,K||re[N]),ae.type=N,ae.texture=K)}function G(){let N=$[k];N!==void 0&&N.type!==void 0&&(n.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function J(){try{n.compressedTexImage2D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function ee(){try{n.compressedTexImage3D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Ae(){try{n.texSubImage2D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function de(){try{n.texSubImage3D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function he(){try{n.compressedTexSubImage2D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Ne(){try{n.compressedTexSubImage3D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function se(){try{n.texStorage2D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Me(){try{n.texStorage3D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Ye(){try{n.texImage2D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function Ee(){try{n.texImage3D.apply(n,arguments)}catch(N){console.error("THREE.WebGLState:",N)}}function me(N){be.equals(N)===!1&&(n.scissor(N.x,N.y,N.z,N.w),be.copy(N))}function Re(N){Te.equals(N)===!1&&(n.viewport(N.x,N.y,N.z,N.w),Te.copy(N))}function Ie(N,K){let j=l.get(K);j===void 0&&(j=new WeakMap,l.set(K,j));let ae=j.get(N);ae===void 0&&(ae=n.getUniformBlockIndex(K,N.name),j.set(N,ae))}function tt(N,K){let ae=l.get(K).get(N);a.get(K)!==ae&&(n.uniformBlockBinding(K,ae,N.__bindingPointIndex),a.set(K,ae))}function Fe(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),c={},k=null,$={},u={},h=new WeakMap,d=[],p=null,v=!1,_=null,m=null,f=null,g=null,y=null,x=null,R=null,T=new we(0,0,0),b=0,C=!1,E=null,M=null,L=null,U=null,I=null,be.set(0,0,n.canvas.width,n.canvas.height),Te.set(0,0,n.canvas.width,n.canvas.height),r.reset(),s.reset(),o.reset()}return{buffers:{color:r,depth:s,stencil:o},enable:pe,disable:oe,bindFramebuffer:Pe,drawBuffers:ke,useProgram:F,setBlending:Je,setMaterial:_e,setFlipSided:ye,setCullFace:Oe,setLineWidth:Xe,setPolygonOffset:ut,setScissorTest:w,activeTexture:S,bindTexture:D,unbindTexture:G,compressedTexImage2D:J,compressedTexImage3D:ee,texImage2D:Ye,texImage3D:Ee,updateUBOMapping:Ie,uniformBlockBinding:tt,texStorage2D:se,texStorage3D:Me,texSubImage2D:Ae,texSubImage3D:de,compressedTexSubImage2D:he,compressedTexSubImage3D:Ne,scissor:me,viewport:Re,reset:Fe}}function IR(n,e,t,i,r,s,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Le,u=new WeakMap,h,d=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function v(w,S){return p?new OffscreenCanvas(w,S):el("canvas")}function _(w,S,D){let G=1,J=ut(w);if((J.width>D||J.height>D)&&(G=D/Math.max(J.width,J.height)),G<1)if(typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&w instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&w instanceof ImageBitmap||typeof VideoFrame<"u"&&w instanceof VideoFrame){let ee=Math.floor(G*J.width),Ae=Math.floor(G*J.height);h===void 0&&(h=v(ee,Ae));let de=S?v(ee,Ae):h;return de.width=ee,de.height=Ae,de.getContext("2d").drawImage(w,0,0,ee,Ae),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+J.width+"x"+J.height+") to ("+ee+"x"+Ae+")."),de}else return"data"in w&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+J.width+"x"+J.height+")."),w;return w}function m(w){return w.generateMipmaps&&w.minFilter!==cn&&w.minFilter!==An}function f(w){n.generateMipmap(w)}function g(w,S,D,G,J=!1){if(w!==null){if(n[w]!==void 0)return n[w];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+w+"'")}let ee=S;if(S===n.RED&&(D===n.FLOAT&&(ee=n.R32F),D===n.HALF_FLOAT&&(ee=n.R16F),D===n.UNSIGNED_BYTE&&(ee=n.R8)),S===n.RED_INTEGER&&(D===n.UNSIGNED_BYTE&&(ee=n.R8UI),D===n.UNSIGNED_SHORT&&(ee=n.R16UI),D===n.UNSIGNED_INT&&(ee=n.R32UI),D===n.BYTE&&(ee=n.R8I),D===n.SHORT&&(ee=n.R16I),D===n.INT&&(ee=n.R32I)),S===n.RG&&(D===n.FLOAT&&(ee=n.RG32F),D===n.HALF_FLOAT&&(ee=n.RG16F),D===n.UNSIGNED_BYTE&&(ee=n.RG8)),S===n.RG_INTEGER&&(D===n.UNSIGNED_BYTE&&(ee=n.RG8UI),D===n.UNSIGNED_SHORT&&(ee=n.RG16UI),D===n.UNSIGNED_INT&&(ee=n.RG32UI),D===n.BYTE&&(ee=n.RG8I),D===n.SHORT&&(ee=n.RG16I),D===n.INT&&(ee=n.RG32I)),S===n.RGB&&D===n.UNSIGNED_INT_5_9_9_9_REV&&(ee=n.RGB9_E5),S===n.RGBA){let Ae=J?vu:nt.getTransfer(G);D===n.FLOAT&&(ee=n.RGBA32F),D===n.HALF_FLOAT&&(ee=n.RGBA16F),D===n.UNSIGNED_BYTE&&(ee=Ae===mt?n.SRGB8_ALPHA8:n.RGBA8),D===n.UNSIGNED_SHORT_4_4_4_4&&(ee=n.RGBA4),D===n.UNSIGNED_SHORT_5_5_5_1&&(ee=n.RGB5_A1)}return(ee===n.R16F||ee===n.R32F||ee===n.RG16F||ee===n.RG32F||ee===n.RGBA16F||ee===n.RGBA32F)&&e.get("EXT_color_buffer_float"),ee}function y(w,S){return m(w)===!0||w.isFramebufferTexture&&w.minFilter!==cn&&w.minFilter!==An?Math.log2(Math.max(S.width,S.height))+1:w.mipmaps!==void 0&&w.mipmaps.length>0?w.mipmaps.length:w.isCompressedTexture&&Array.isArray(w.image)?S.mipmaps.length:1}function x(w){let S=w.target;S.removeEventListener("dispose",x),T(S),S.isVideoTexture&&u.delete(S)}function R(w){let S=w.target;S.removeEventListener("dispose",R),C(S)}function T(w){let S=i.get(w);if(S.__webglInit===void 0)return;let D=w.source,G=d.get(D);if(G){let J=G[S.__cacheKey];J.usedTimes--,J.usedTimes===0&&b(w),Object.keys(G).length===0&&d.delete(D)}i.remove(w)}function b(w){let S=i.get(w);n.deleteTexture(S.__webglTexture);let D=w.source,G=d.get(D);delete G[S.__cacheKey],o.memory.textures--}function C(w){let S=i.get(w);if(w.depthTexture&&w.depthTexture.dispose(),w.isWebGLCubeRenderTarget)for(let G=0;G<6;G++){if(Array.isArray(S.__webglFramebuffer[G]))for(let J=0;J<S.__webglFramebuffer[G].length;J++)n.deleteFramebuffer(S.__webglFramebuffer[G][J]);else n.deleteFramebuffer(S.__webglFramebuffer[G]);S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer[G])}else{if(Array.isArray(S.__webglFramebuffer))for(let G=0;G<S.__webglFramebuffer.length;G++)n.deleteFramebuffer(S.__webglFramebuffer[G]);else n.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&n.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&n.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let G=0;G<S.__webglColorRenderbuffer.length;G++)S.__webglColorRenderbuffer[G]&&n.deleteRenderbuffer(S.__webglColorRenderbuffer[G]);S.__webglDepthRenderbuffer&&n.deleteRenderbuffer(S.__webglDepthRenderbuffer)}let D=w.textures;for(let G=0,J=D.length;G<J;G++){let ee=i.get(D[G]);ee.__webglTexture&&(n.deleteTexture(ee.__webglTexture),o.memory.textures--),i.remove(D[G])}i.remove(w)}let E=0;function M(){E=0}function L(){let w=E;return w>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+w+" texture units while this GPU supports only "+r.maxTextures),E+=1,w}function U(w){let S=[];return S.push(w.wrapS),S.push(w.wrapT),S.push(w.wrapR||0),S.push(w.magFilter),S.push(w.minFilter),S.push(w.anisotropy),S.push(w.internalFormat),S.push(w.format),S.push(w.type),S.push(w.generateMipmaps),S.push(w.premultiplyAlpha),S.push(w.flipY),S.push(w.unpackAlignment),S.push(w.colorSpace),S.join()}function I(w,S){let D=i.get(w);if(w.isVideoTexture&&Oe(w),w.isRenderTargetTexture===!1&&w.version>0&&D.__version!==w.version){let G=w.image;if(G===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(G.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{be(D,w,S);return}}t.bindTexture(n.TEXTURE_2D,D.__webglTexture,n.TEXTURE0+S)}function H(w,S){let D=i.get(w);if(w.version>0&&D.__version!==w.version){be(D,w,S);return}t.bindTexture(n.TEXTURE_2D_ARRAY,D.__webglTexture,n.TEXTURE0+S)}function Y(w,S){let D=i.get(w);if(w.version>0&&D.__version!==w.version){be(D,w,S);return}t.bindTexture(n.TEXTURE_3D,D.__webglTexture,n.TEXTURE0+S)}function q(w,S){let D=i.get(w);if(w.version>0&&D.__version!==w.version){Te(D,w,S);return}t.bindTexture(n.TEXTURE_CUBE_MAP,D.__webglTexture,n.TEXTURE0+S)}let te={[ps]:n.REPEAT,[Yi]:n.CLAMP_TO_EDGE,[Ja]:n.MIRRORED_REPEAT},k={[cn]:n.NEAREST,[em]:n.NEAREST_MIPMAP_NEAREST,[vo]:n.NEAREST_MIPMAP_LINEAR,[An]:n.LINEAR,[ja]:n.LINEAR_MIPMAP_NEAREST,[Mi]:n.LINEAR_MIPMAP_LINEAR},$={[Ew]:n.NEVER,[Pw]:n.ALWAYS,[Tw]:n.LESS,[Tx]:n.LEQUAL,[Aw]:n.EQUAL,[Cw]:n.GEQUAL,[bw]:n.GREATER,[Rw]:n.NOTEQUAL};function Q(w,S){if(S.type===Si&&e.has("OES_texture_float_linear")===!1&&(S.magFilter===An||S.magFilter===ja||S.magFilter===vo||S.magFilter===Mi||S.minFilter===An||S.minFilter===ja||S.minFilter===vo||S.minFilter===Mi)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(w,n.TEXTURE_WRAP_S,te[S.wrapS]),n.texParameteri(w,n.TEXTURE_WRAP_T,te[S.wrapT]),(w===n.TEXTURE_3D||w===n.TEXTURE_2D_ARRAY)&&n.texParameteri(w,n.TEXTURE_WRAP_R,te[S.wrapR]),n.texParameteri(w,n.TEXTURE_MAG_FILTER,k[S.magFilter]),n.texParameteri(w,n.TEXTURE_MIN_FILTER,k[S.minFilter]),S.compareFunction&&(n.texParameteri(w,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(w,n.TEXTURE_COMPARE_FUNC,$[S.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===cn||S.minFilter!==vo&&S.minFilter!==Mi||S.type===Si&&e.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||i.get(S).__currentAnisotropy){let D=e.get("EXT_texture_filter_anisotropic");n.texParameterf(w,D.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,r.getMaxAnisotropy())),i.get(S).__currentAnisotropy=S.anisotropy}}}function le(w,S){let D=!1;w.__webglInit===void 0&&(w.__webglInit=!0,S.addEventListener("dispose",x));let G=S.source,J=d.get(G);J===void 0&&(J={},d.set(G,J));let ee=U(S);if(ee!==w.__cacheKey){J[ee]===void 0&&(J[ee]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,D=!0),J[ee].usedTimes++;let Ae=J[w.__cacheKey];Ae!==void 0&&(J[w.__cacheKey].usedTimes--,Ae.usedTimes===0&&b(S)),w.__cacheKey=ee,w.__webglTexture=J[ee].texture}return D}function be(w,S,D){let G=n.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(G=n.TEXTURE_2D_ARRAY),S.isData3DTexture&&(G=n.TEXTURE_3D);let J=le(w,S),ee=S.source;t.bindTexture(G,w.__webglTexture,n.TEXTURE0+D);let Ae=i.get(ee);if(ee.version!==Ae.__version||J===!0){t.activeTexture(n.TEXTURE0+D);let de=nt.getPrimaries(nt.workingColorSpace),he=S.colorSpace===Pr?null:nt.getPrimaries(S.colorSpace),Ne=S.colorSpace===Pr||de===he?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ne);let se=_(S.image,!1,r.maxTextureSize);se=Xe(S,se);let Me=s.convert(S.format,S.colorSpace),Ye=s.convert(S.type),Ee=g(S.internalFormat,Me,Ye,S.colorSpace,S.isVideoTexture);Q(G,S);let me,Re=S.mipmaps,Ie=S.isVideoTexture!==!0,tt=Ae.__version===void 0||J===!0,Fe=ee.dataReady,N=y(S,se);if(S.isDepthTexture)Ee=n.DEPTH_COMPONENT16,S.type===Si?Ee=n.DEPTH_COMPONENT32F:S.type===Ro?Ee=n.DEPTH_COMPONENT24:S.type===dl&&(Ee=n.DEPTH24_STENCIL8),tt&&(Ie?t.texStorage2D(n.TEXTURE_2D,1,Ee,se.width,se.height):t.texImage2D(n.TEXTURE_2D,0,Ee,se.width,se.height,0,Me,Ye,null));else if(S.isDataTexture)if(Re.length>0){Ie&&tt&&t.texStorage2D(n.TEXTURE_2D,N,Ee,Re[0].width,Re[0].height);for(let K=0,j=Re.length;K<j;K++)me=Re[K],Ie?Fe&&t.texSubImage2D(n.TEXTURE_2D,K,0,0,me.width,me.height,Me,Ye,me.data):t.texImage2D(n.TEXTURE_2D,K,Ee,me.width,me.height,0,Me,Ye,me.data);S.generateMipmaps=!1}else Ie?(tt&&t.texStorage2D(n.TEXTURE_2D,N,Ee,se.width,se.height),Fe&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,se.width,se.height,Me,Ye,se.data)):t.texImage2D(n.TEXTURE_2D,0,Ee,se.width,se.height,0,Me,Ye,se.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){Ie&&tt&&t.texStorage3D(n.TEXTURE_2D_ARRAY,N,Ee,Re[0].width,Re[0].height,se.depth);for(let K=0,j=Re.length;K<j;K++)me=Re[K],S.format!==hi?Me!==null?Ie?Fe&&t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,K,0,0,0,me.width,me.height,se.depth,Me,me.data,0,0):t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,K,Ee,me.width,me.height,se.depth,0,me.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ie?Fe&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,K,0,0,0,me.width,me.height,se.depth,Me,Ye,me.data):t.texImage3D(n.TEXTURE_2D_ARRAY,K,Ee,me.width,me.height,se.depth,0,Me,Ye,me.data)}else{Ie&&tt&&t.texStorage2D(n.TEXTURE_2D,N,Ee,Re[0].width,Re[0].height);for(let K=0,j=Re.length;K<j;K++)me=Re[K],S.format!==hi?Me!==null?Ie?Fe&&t.compressedTexSubImage2D(n.TEXTURE_2D,K,0,0,me.width,me.height,Me,me.data):t.compressedTexImage2D(n.TEXTURE_2D,K,Ee,me.width,me.height,0,me.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ie?Fe&&t.texSubImage2D(n.TEXTURE_2D,K,0,0,me.width,me.height,Me,Ye,me.data):t.texImage2D(n.TEXTURE_2D,K,Ee,me.width,me.height,0,Me,Ye,me.data)}else if(S.isDataArrayTexture)Ie?(tt&&t.texStorage3D(n.TEXTURE_2D_ARRAY,N,Ee,se.width,se.height,se.depth),Fe&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,se.width,se.height,se.depth,Me,Ye,se.data)):t.texImage3D(n.TEXTURE_2D_ARRAY,0,Ee,se.width,se.height,se.depth,0,Me,Ye,se.data);else if(S.isData3DTexture)Ie?(tt&&t.texStorage3D(n.TEXTURE_3D,N,Ee,se.width,se.height,se.depth),Fe&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,se.width,se.height,se.depth,Me,Ye,se.data)):t.texImage3D(n.TEXTURE_3D,0,Ee,se.width,se.height,se.depth,0,Me,Ye,se.data);else if(S.isFramebufferTexture){if(tt)if(Ie)t.texStorage2D(n.TEXTURE_2D,N,Ee,se.width,se.height);else{let K=se.width,j=se.height;for(let ae=0;ae<N;ae++)t.texImage2D(n.TEXTURE_2D,ae,Ee,K,j,0,Me,Ye,null),K>>=1,j>>=1}}else if(Re.length>0){if(Ie&&tt){let K=ut(Re[0]);t.texStorage2D(n.TEXTURE_2D,N,Ee,K.width,K.height)}for(let K=0,j=Re.length;K<j;K++)me=Re[K],Ie?Fe&&t.texSubImage2D(n.TEXTURE_2D,K,0,0,Me,Ye,me):t.texImage2D(n.TEXTURE_2D,K,Ee,Me,Ye,me);S.generateMipmaps=!1}else if(Ie){if(tt){let K=ut(se);t.texStorage2D(n.TEXTURE_2D,N,Ee,K.width,K.height)}Fe&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,Me,Ye,se)}else t.texImage2D(n.TEXTURE_2D,0,Ee,Me,Ye,se);m(S)&&f(G),Ae.__version=ee.version,S.onUpdate&&S.onUpdate(S)}w.__version=S.version}function Te(w,S,D){if(S.image.length!==6)return;let G=le(w,S),J=S.source;t.bindTexture(n.TEXTURE_CUBE_MAP,w.__webglTexture,n.TEXTURE0+D);let ee=i.get(J);if(J.version!==ee.__version||G===!0){t.activeTexture(n.TEXTURE0+D);let Ae=nt.getPrimaries(nt.workingColorSpace),de=S.colorSpace===Pr?null:nt.getPrimaries(S.colorSpace),he=S.colorSpace===Pr||Ae===de?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,S.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,S.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,he);let Ne=S.isCompressedTexture||S.image[0].isCompressedTexture,se=S.image[0]&&S.image[0].isDataTexture,Me=[];for(let j=0;j<6;j++)!Ne&&!se?Me[j]=_(S.image[j],!0,r.maxCubemapSize):Me[j]=se?S.image[j].image:S.image[j],Me[j]=Xe(S,Me[j]);let Ye=Me[0],Ee=s.convert(S.format,S.colorSpace),me=s.convert(S.type),Re=g(S.internalFormat,Ee,me,S.colorSpace),Ie=S.isVideoTexture!==!0,tt=ee.__version===void 0||G===!0,Fe=J.dataReady,N=y(S,Ye);Q(n.TEXTURE_CUBE_MAP,S);let K;if(Ne){Ie&&tt&&t.texStorage2D(n.TEXTURE_CUBE_MAP,N,Re,Ye.width,Ye.height);for(let j=0;j<6;j++){K=Me[j].mipmaps;for(let ae=0;ae<K.length;ae++){let ce=K[ae];S.format!==hi?Ee!==null?Ie?Fe&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae,0,0,ce.width,ce.height,Ee,ce.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae,Re,ce.width,ce.height,0,ce.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ie?Fe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae,0,0,ce.width,ce.height,Ee,me,ce.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae,Re,ce.width,ce.height,0,Ee,me,ce.data)}}}else{if(K=S.mipmaps,Ie&&tt){K.length>0&&N++;let j=ut(Me[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,N,Re,j.width,j.height)}for(let j=0;j<6;j++)if(se){Ie?Fe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,Me[j].width,Me[j].height,Ee,me,Me[j].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Re,Me[j].width,Me[j].height,0,Ee,me,Me[j].data);for(let ae=0;ae<K.length;ae++){let De=K[ae].image[j].image;Ie?Fe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae+1,0,0,De.width,De.height,Ee,me,De.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae+1,Re,De.width,De.height,0,Ee,me,De.data)}}else{Ie?Fe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,Ee,me,Me[j]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Re,Ee,me,Me[j]);for(let ae=0;ae<K.length;ae++){let ce=K[ae];Ie?Fe&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae+1,0,0,Ee,me,ce.image[j]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+j,ae+1,Re,Ee,me,ce.image[j])}}}m(S)&&f(n.TEXTURE_CUBE_MAP),ee.__version=J.version,S.onUpdate&&S.onUpdate(S)}w.__version=S.version}function X(w,S,D,G,J,ee){let Ae=s.convert(D.format,D.colorSpace),de=s.convert(D.type),he=g(D.internalFormat,Ae,de,D.colorSpace);if(!i.get(S).__hasExternalTextures){let se=Math.max(1,S.width>>ee),Me=Math.max(1,S.height>>ee);J===n.TEXTURE_3D||J===n.TEXTURE_2D_ARRAY?t.texImage3D(J,ee,he,se,Me,S.depth,0,Ae,de,null):t.texImage2D(J,ee,he,se,Me,0,Ae,de,null)}t.bindFramebuffer(n.FRAMEBUFFER,w),ye(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,G,J,i.get(D).__webglTexture,0,_e(S)):(J===n.TEXTURE_2D||J>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&J<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,G,J,i.get(D).__webglTexture,ee),t.bindFramebuffer(n.FRAMEBUFFER,null)}function re(w,S,D){if(n.bindRenderbuffer(n.RENDERBUFFER,w),S.depthBuffer&&!S.stencilBuffer){let G=n.DEPTH_COMPONENT24;if(D||ye(S)){let J=S.depthTexture;J&&J.isDepthTexture&&(J.type===Si?G=n.DEPTH_COMPONENT32F:J.type===Ro&&(G=n.DEPTH_COMPONENT24));let ee=_e(S);ye(S)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ee,G,S.width,S.height):n.renderbufferStorageMultisample(n.RENDERBUFFER,ee,G,S.width,S.height)}else n.renderbufferStorage(n.RENDERBUFFER,G,S.width,S.height);n.framebufferRenderbuffer(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.RENDERBUFFER,w)}else if(S.depthBuffer&&S.stencilBuffer){let G=_e(S);D&&ye(S)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,G,n.DEPTH24_STENCIL8,S.width,S.height):ye(S)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,G,n.DEPTH24_STENCIL8,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,n.DEPTH_STENCIL,S.width,S.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.RENDERBUFFER,w)}else{let G=S.textures;for(let J=0;J<G.length;J++){let ee=G[J],Ae=s.convert(ee.format,ee.colorSpace),de=s.convert(ee.type),he=g(ee.internalFormat,Ae,de,ee.colorSpace),Ne=_e(S);D&&ye(S)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,Ne,he,S.width,S.height):ye(S)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,Ne,he,S.width,S.height):n.renderbufferStorage(n.RENDERBUFFER,he,S.width,S.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function pe(w,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,w),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!i.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),I(S.depthTexture,0);let G=i.get(S.depthTexture).__webglTexture,J=_e(S);if(S.depthTexture.format===wo)ye(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,G,0,J):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,G,0);else if(S.depthTexture.format===Qa)ye(S)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,G,0,J):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,G,0);else throw new Error("Unknown depthTexture format")}function oe(w){let S=i.get(w),D=w.isWebGLCubeRenderTarget===!0;if(w.depthTexture&&!S.__autoAllocateDepthBuffer){if(D)throw new Error("target.depthTexture not supported in Cube render targets");pe(S.__webglFramebuffer,w)}else if(D){S.__webglDepthbuffer=[];for(let G=0;G<6;G++)t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer[G]),S.__webglDepthbuffer[G]=n.createRenderbuffer(),re(S.__webglDepthbuffer[G],w,!1)}else t.bindFramebuffer(n.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer=n.createRenderbuffer(),re(S.__webglDepthbuffer,w,!1);t.bindFramebuffer(n.FRAMEBUFFER,null)}function Pe(w,S,D){let G=i.get(w);S!==void 0&&X(G.__webglFramebuffer,w,w.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),D!==void 0&&oe(w)}function ke(w){let S=w.texture,D=i.get(w),G=i.get(S);w.addEventListener("dispose",R);let J=w.textures,ee=w.isWebGLCubeRenderTarget===!0,Ae=J.length>1;if(Ae||(G.__webglTexture===void 0&&(G.__webglTexture=n.createTexture()),G.__version=S.version,o.memory.textures++),ee){D.__webglFramebuffer=[];for(let de=0;de<6;de++)if(S.mipmaps&&S.mipmaps.length>0){D.__webglFramebuffer[de]=[];for(let he=0;he<S.mipmaps.length;he++)D.__webglFramebuffer[de][he]=n.createFramebuffer()}else D.__webglFramebuffer[de]=n.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){D.__webglFramebuffer=[];for(let de=0;de<S.mipmaps.length;de++)D.__webglFramebuffer[de]=n.createFramebuffer()}else D.__webglFramebuffer=n.createFramebuffer();if(Ae)for(let de=0,he=J.length;de<he;de++){let Ne=i.get(J[de]);Ne.__webglTexture===void 0&&(Ne.__webglTexture=n.createTexture(),o.memory.textures++)}if(w.samples>0&&ye(w)===!1){D.__webglMultisampledFramebuffer=n.createFramebuffer(),D.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,D.__webglMultisampledFramebuffer);for(let de=0;de<J.length;de++){let he=J[de];D.__webglColorRenderbuffer[de]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,D.__webglColorRenderbuffer[de]);let Ne=s.convert(he.format,he.colorSpace),se=s.convert(he.type),Me=g(he.internalFormat,Ne,se,he.colorSpace,w.isXRRenderTarget===!0),Ye=_e(w);n.renderbufferStorageMultisample(n.RENDERBUFFER,Ye,Me,w.width,w.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+de,n.RENDERBUFFER,D.__webglColorRenderbuffer[de])}n.bindRenderbuffer(n.RENDERBUFFER,null),w.depthBuffer&&(D.__webglDepthRenderbuffer=n.createRenderbuffer(),re(D.__webglDepthRenderbuffer,w,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ee){t.bindTexture(n.TEXTURE_CUBE_MAP,G.__webglTexture),Q(n.TEXTURE_CUBE_MAP,S);for(let de=0;de<6;de++)if(S.mipmaps&&S.mipmaps.length>0)for(let he=0;he<S.mipmaps.length;he++)X(D.__webglFramebuffer[de][he],w,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+de,he);else X(D.__webglFramebuffer[de],w,S,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+de,0);m(S)&&f(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Ae){for(let de=0,he=J.length;de<he;de++){let Ne=J[de],se=i.get(Ne);t.bindTexture(n.TEXTURE_2D,se.__webglTexture),Q(n.TEXTURE_2D,Ne),X(D.__webglFramebuffer,w,Ne,n.COLOR_ATTACHMENT0+de,n.TEXTURE_2D,0),m(Ne)&&f(n.TEXTURE_2D)}t.unbindTexture()}else{let de=n.TEXTURE_2D;if((w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(de=w.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(de,G.__webglTexture),Q(de,S),S.mipmaps&&S.mipmaps.length>0)for(let he=0;he<S.mipmaps.length;he++)X(D.__webglFramebuffer[he],w,S,n.COLOR_ATTACHMENT0,de,he);else X(D.__webglFramebuffer,w,S,n.COLOR_ATTACHMENT0,de,0);m(S)&&f(de),t.unbindTexture()}w.depthBuffer&&oe(w)}function F(w){let S=w.textures;for(let D=0,G=S.length;D<G;D++){let J=S[D];if(m(J)){let ee=w.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:n.TEXTURE_2D,Ae=i.get(J).__webglTexture;t.bindTexture(ee,Ae),f(ee),t.unbindTexture()}}}let $e=[],ve=[];function Je(w){if(w.samples>0){if(ye(w)===!1){let S=w.textures,D=w.width,G=w.height,J=n.COLOR_BUFFER_BIT,ee=w.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Ae=i.get(w),de=S.length>1;if(de)for(let he=0;he<S.length;he++)t.bindFramebuffer(n.FRAMEBUFFER,Ae.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,Ae.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,Ae.__webglMultisampledFramebuffer),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,Ae.__webglFramebuffer);for(let he=0;he<S.length;he++){if(w.resolveDepthBuffer&&(w.depthBuffer&&(J|=n.DEPTH_BUFFER_BIT),w.stencilBuffer&&w.resolveStencilBuffer&&(J|=n.STENCIL_BUFFER_BIT)),de){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,Ae.__webglColorRenderbuffer[he]);let Ne=i.get(S[he]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,Ne,0)}n.blitFramebuffer(0,0,D,G,0,0,D,G,J,n.NEAREST),l===!0&&($e.length=0,ve.length=0,$e.push(n.COLOR_ATTACHMENT0+he),w.depthBuffer&&w.resolveDepthBuffer===!1&&($e.push(ee),ve.push(ee),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,ve)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,$e))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),de)for(let he=0;he<S.length;he++){t.bindFramebuffer(n.FRAMEBUFFER,Ae.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.RENDERBUFFER,Ae.__webglColorRenderbuffer[he]);let Ne=i.get(S[he]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,Ae.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.TEXTURE_2D,Ne,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,Ae.__webglMultisampledFramebuffer)}else if(w.depthBuffer&&w.resolveDepthBuffer===!1&&l){let S=w.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[S])}}}function _e(w){return Math.min(r.maxSamples,w.samples)}function ye(w){let S=i.get(w);return w.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function Oe(w){let S=o.render.frame;u.get(w)!==S&&(u.set(w,S),w.update())}function Xe(w,S){let D=w.colorSpace,G=w.format,J=w.type;return w.isCompressedTexture===!0||w.isVideoTexture===!0||D!==jt&&D!==Pr&&(nt.getTransfer(D)===mt?(G!==hi||J!==Nr)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",D)),S}function ut(w){return typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement?(c.width=w.naturalWidth||w.width,c.height=w.naturalHeight||w.height):typeof VideoFrame<"u"&&w instanceof VideoFrame?(c.width=w.displayWidth,c.height=w.displayHeight):(c.width=w.width,c.height=w.height),c}this.allocateTextureUnit=L,this.resetTextureUnits=M,this.setTexture2D=I,this.setTexture2DArray=H,this.setTexture3D=Y,this.setTextureCube=q,this.rebindTextures=Pe,this.setupRenderTarget=ke,this.updateRenderTargetMipmap=F,this.updateMultisampleRenderTarget=Je,this.setupDepthRenderbuffer=oe,this.setupFrameBufferTexture=X,this.useMultisampledRTT=ye}function LR(n,e){function t(i,r=Pr){let s,o=nt.getTransfer(r);if(i===Nr)return n.UNSIGNED_BYTE;if(i===vx)return n.UNSIGNED_SHORT_4_4_4_4;if(i===yx)return n.UNSIGNED_SHORT_5_5_5_1;if(i===uw)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===lw)return n.BYTE;if(i===cw)return n.SHORT;if(i===mx)return n.UNSIGNED_SHORT;if(i===gx)return n.INT;if(i===Ro)return n.UNSIGNED_INT;if(i===Si)return n.FLOAT;if(i===Zu)return n.HALF_FLOAT;if(i===hw)return n.ALPHA;if(i===dw)return n.RGB;if(i===hi)return n.RGBA;if(i===fw)return n.LUMINANCE;if(i===pw)return n.LUMINANCE_ALPHA;if(i===wo)return n.DEPTH_COMPONENT;if(i===Qa)return n.DEPTH_STENCIL;if(i===_x)return n.RED;if(i===xx)return n.RED_INTEGER;if(i===mw)return n.RG;if(i===Mx)return n.RG_INTEGER;if(i===Sx)return n.RGBA_INTEGER;if(i===Of||i===Ff||i===kf||i===zf)if(o===mt)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Of)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Ff)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===kf)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===zf)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Of)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Ff)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===kf)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===zf)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Iy||i===Ly||i===Ny||i===Dy)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===Iy)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Ly)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Ny)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Dy)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Uy||i===Oy||i===Fy)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===Uy||i===Oy)return o===mt?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===Fy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===ky||i===zy||i===By||i===Vy||i===Hy||i===Gy||i===Wy||i===Xy||i===qy||i===Yy||i===jy||i===Ky||i===Zy||i===$y)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===ky)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===zy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===By)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Vy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Hy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Gy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Wy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Xy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===qy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Yy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===jy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Ky)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Zy)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===$y)return o===mt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Bf||i===Jy||i===Qy)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Bf)return o===mt?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Jy)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Qy)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===gw||i===e_||i===t_||i===n_)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===Bf)return s.COMPRESSED_RED_RGTC1_EXT;if(i===e_)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===t_)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===n_)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===dl?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var Up=class extends Ft{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}},un=class extends Tt{constructor(){super(),this.isGroup=!0,this.type="Group"}},NR={type:"move"},$a=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new un,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new un,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new P,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new P),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new un,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new P,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new P),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let _ of e.hand.values()){let m=t.getJointPose(_,i),f=this._getHandJoint(c,_);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}let u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),p=.02,v=.005;c.inputState.pinching&&d>p+v?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=p-v&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(NR)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new un;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},DR=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,UR=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Op=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,i){if(this.texture===null){let r=new Dt,s=e.properties.get(r);s.__webglTexture=t.texture,(t.depthNear!=i.depthNear||t.depthFar!=i.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=r}}render(e,t){if(this.texture!==null){if(this.mesh===null){let i=t.cameras[0].viewport,r=new _n({vertexShader:DR,fragmentShader:UR,uniforms:{depthColor:{value:this.texture},depthWidth:{value:i.z},depthHeight:{value:i.w}}});this.mesh=new st(new Lo(20,20),r)}e.render(this.mesh,t)}}reset(){this.texture=null,this.mesh=null}},Fp=class extends Ki{constructor(e,t){super();let i=this,r=null,s=1,o=null,a="local-floor",l=1,c=null,u=null,h=null,d=null,p=null,v=null,_=new Op,m=t.getContextAttributes(),f=null,g=null,y=[],x=[],R=new Le,T=null,b=new Ft;b.layers.enable(1),b.viewport=new ct;let C=new Ft;C.layers.enable(2),C.viewport=new ct;let E=[b,C],M=new Up;M.layers.enable(1),M.layers.enable(2);let L=null,U=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(X){let re=y[X];return re===void 0&&(re=new $a,y[X]=re),re.getTargetRaySpace()},this.getControllerGrip=function(X){let re=y[X];return re===void 0&&(re=new $a,y[X]=re),re.getGripSpace()},this.getHand=function(X){let re=y[X];return re===void 0&&(re=new $a,y[X]=re),re.getHandSpace()};function I(X){let re=x.indexOf(X.inputSource);if(re===-1)return;let pe=y[re];pe!==void 0&&(pe.update(X.inputSource,X.frame,c||o),pe.dispatchEvent({type:X.type,data:X.inputSource}))}function H(){r.removeEventListener("select",I),r.removeEventListener("selectstart",I),r.removeEventListener("selectend",I),r.removeEventListener("squeeze",I),r.removeEventListener("squeezestart",I),r.removeEventListener("squeezeend",I),r.removeEventListener("end",H),r.removeEventListener("inputsourceschange",Y);for(let X=0;X<y.length;X++){let re=x[X];re!==null&&(x[X]=null,y[X].disconnect(re))}L=null,U=null,_.reset(),e.setRenderTarget(f),p=null,d=null,h=null,r=null,g=null,Te.stop(),i.isPresenting=!1,e.setPixelRatio(T),e.setSize(R.width,R.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(X){s=X,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(X){a=X,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(X){c=X},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return h},this.getFrame=function(){return v},this.getSession=function(){return r},this.setSession=async function(X){if(r=X,r!==null){if(f=e.getRenderTarget(),r.addEventListener("select",I),r.addEventListener("selectstart",I),r.addEventListener("selectend",I),r.addEventListener("squeeze",I),r.addEventListener("squeezestart",I),r.addEventListener("squeezeend",I),r.addEventListener("end",H),r.addEventListener("inputsourceschange",Y),m.xrCompatible!==!0&&await t.makeXRCompatible(),T=e.getPixelRatio(),e.getSize(R),r.renderState.layers===void 0){let re={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:s};p=new XRWebGLLayer(r,t,re),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),g=new Zi(p.framebufferWidth,p.framebufferHeight,{format:hi,type:Nr,colorSpace:e.outputColorSpace,stencilBuffer:m.stencil})}else{let re=null,pe=null,oe=null;m.depth&&(oe=m.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,re=m.stencil?Qa:wo,pe=m.stencil?dl:Ro);let Pe={colorFormat:t.RGBA8,depthFormat:oe,scaleFactor:s};h=new XRWebGLBinding(r,t),d=h.createProjectionLayer(Pe),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),g=new Zi(d.textureWidth,d.textureHeight,{format:hi,type:Nr,depthTexture:new bu(d.textureWidth,d.textureHeight,pe,void 0,void 0,void 0,void 0,void 0,void 0,re),stencilBuffer:m.stencil,colorSpace:e.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}g.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await r.requestReferenceSpace(a),Te.setContext(r),Te.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode};function Y(X){for(let re=0;re<X.removed.length;re++){let pe=X.removed[re],oe=x.indexOf(pe);oe>=0&&(x[oe]=null,y[oe].disconnect(pe))}for(let re=0;re<X.added.length;re++){let pe=X.added[re],oe=x.indexOf(pe);if(oe===-1){for(let ke=0;ke<y.length;ke++)if(ke>=x.length){x.push(pe),oe=ke;break}else if(x[ke]===null){x[ke]=pe,oe=ke;break}if(oe===-1)break}let Pe=y[oe];Pe&&Pe.connect(pe)}}let q=new P,te=new P;function k(X,re,pe){q.setFromMatrixPosition(re.matrixWorld),te.setFromMatrixPosition(pe.matrixWorld);let oe=q.distanceTo(te),Pe=re.projectionMatrix.elements,ke=pe.projectionMatrix.elements,F=Pe[14]/(Pe[10]-1),$e=Pe[14]/(Pe[10]+1),ve=(Pe[9]+1)/Pe[5],Je=(Pe[9]-1)/Pe[5],_e=(Pe[8]-1)/Pe[0],ye=(ke[8]+1)/ke[0],Oe=F*_e,Xe=F*ye,ut=oe/(-_e+ye),w=ut*-_e;re.matrixWorld.decompose(X.position,X.quaternion,X.scale),X.translateX(w),X.translateZ(ut),X.matrixWorld.compose(X.position,X.quaternion,X.scale),X.matrixWorldInverse.copy(X.matrixWorld).invert();let S=F+ut,D=$e+ut,G=Oe-w,J=Xe+(oe-w),ee=ve*$e/D*S,Ae=Je*$e/D*S;X.projectionMatrix.makePerspective(G,J,ee,Ae,S,D),X.projectionMatrixInverse.copy(X.projectionMatrix).invert()}function $(X,re){re===null?X.matrixWorld.copy(X.matrix):X.matrixWorld.multiplyMatrices(re.matrixWorld,X.matrix),X.matrixWorldInverse.copy(X.matrixWorld).invert()}this.updateCamera=function(X){if(r===null)return;_.texture!==null&&(X.near=_.depthNear,X.far=_.depthFar),M.near=C.near=b.near=X.near,M.far=C.far=b.far=X.far,(L!==M.near||U!==M.far)&&(r.updateRenderState({depthNear:M.near,depthFar:M.far}),L=M.near,U=M.far,b.near=L,b.far=U,C.near=L,C.far=U,b.updateProjectionMatrix(),C.updateProjectionMatrix(),X.updateProjectionMatrix());let re=X.parent,pe=M.cameras;$(M,re);for(let oe=0;oe<pe.length;oe++)$(pe[oe],re);pe.length===2?k(M,b,C):M.projectionMatrix.copy(b.projectionMatrix),Q(X,M,re)};function Q(X,re,pe){pe===null?X.matrix.copy(re.matrixWorld):(X.matrix.copy(pe.matrixWorld),X.matrix.invert(),X.matrix.multiply(re.matrixWorld)),X.matrix.decompose(X.position,X.quaternion,X.scale),X.updateMatrixWorld(!0),X.projectionMatrix.copy(re.projectionMatrix),X.projectionMatrixInverse.copy(re.projectionMatrixInverse),X.isPerspectiveCamera&&(X.fov=Po*2*Math.atan(1/X.projectionMatrix.elements[5]),X.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function(X){l=X,d!==null&&(d.fixedFoveation=X),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=X)},this.hasDepthSensing=function(){return _.texture!==null};let le=null;function be(X,re){if(u=re.getViewerPose(c||o),v=re,u!==null){let pe=u.views;p!==null&&(e.setRenderTargetFramebuffer(g,p.framebuffer),e.setRenderTarget(g));let oe=!1;pe.length!==M.cameras.length&&(M.cameras.length=0,oe=!0);for(let ke=0;ke<pe.length;ke++){let F=pe[ke],$e=null;if(p!==null)$e=p.getViewport(F);else{let Je=h.getViewSubImage(d,F);$e=Je.viewport,ke===0&&(e.setRenderTargetTextures(g,Je.colorTexture,d.ignoreDepthValues?void 0:Je.depthStencilTexture),e.setRenderTarget(g))}let ve=E[ke];ve===void 0&&(ve=new Ft,ve.layers.enable(ke),ve.viewport=new ct,E[ke]=ve),ve.matrix.fromArray(F.transform.matrix),ve.matrix.decompose(ve.position,ve.quaternion,ve.scale),ve.projectionMatrix.fromArray(F.projectionMatrix),ve.projectionMatrixInverse.copy(ve.projectionMatrix).invert(),ve.viewport.set($e.x,$e.y,$e.width,$e.height),ke===0&&(M.matrix.copy(ve.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),oe===!0&&M.cameras.push(ve)}let Pe=r.enabledFeatures;if(Pe&&Pe.includes("depth-sensing")){let ke=h.getDepthInformation(pe[0]);ke&&ke.isValid&&ke.texture&&_.init(e,ke,r.renderState)}}for(let pe=0;pe<y.length;pe++){let oe=x[pe],Pe=y[pe];oe!==null&&Pe!==void 0&&Pe.update(oe,re,c||o)}_.render(e,M),le&&le(X,re),re.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:re}),v=null}let Te=new Px;Te.setAnimationLoop(be),this.setAnimationLoop=function(X){le=X},this.dispose=function(){}}},us=new Ei,OR=new Ue;function FR(n,e){function t(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function i(m,f){f.color.getRGB(m.fogColor.value,Cx(n)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function r(m,f,g,y,x){f.isMeshBasicMaterial||f.isMeshLambertMaterial?s(m,f):f.isMeshToonMaterial?(s(m,f),h(m,f)):f.isMeshPhongMaterial?(s(m,f),u(m,f)):f.isMeshStandardMaterial?(s(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,x)):f.isMeshMatcapMaterial?(s(m,f),v(m,f)):f.isMeshDepthMaterial?s(m,f):f.isMeshDistanceMaterial?(s(m,f),_(m,f)):f.isMeshNormalMaterial?s(m,f):f.isLineBasicMaterial?(o(m,f),f.isLineDashedMaterial&&a(m,f)):f.isPointsMaterial?l(m,f,g,y):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function s(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,t(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===Xt&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,t(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===Xt&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,t(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,t(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);let g=e.get(f),y=g.envMap,x=g.envMapRotation;if(y&&(m.envMap.value=y,us.copy(x),us.x*=-1,us.y*=-1,us.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(us.y*=-1,us.z*=-1),m.envMapRotation.value.setFromMatrix4(OR.makeRotationFromEuler(us)),m.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap){m.lightMap.value=f.lightMap;let R=n._useLegacyLights===!0?Math.PI:1;m.lightMapIntensity.value=f.lightMapIntensity*R,t(f.lightMap,m.lightMapTransform)}f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,m.aoMapTransform))}function o(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform))}function a(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,g,y){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*g,m.scale.value=y*.5,f.map&&(m.map.value=f.map,t(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function u(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function h(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,g){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Xt&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=g.texture,m.transmissionSamplerSize.value.set(g.width,g.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,m.specularIntensityMapTransform))}function v(m,f){f.matcap&&(m.matcap.value=f.matcap)}function _(m,f){let g=e.get(f).light;m.referencePosition.value.setFromMatrixPosition(g.matrixWorld),m.nearDistance.value=g.shadow.camera.near,m.farDistance.value=g.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function kR(n,e,t,i){let r={},s={},o=[],a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(g,y){let x=y.program;i.uniformBlockBinding(g,x)}function c(g,y){let x=r[g.id];x===void 0&&(v(g),x=u(g),r[g.id]=x,g.addEventListener("dispose",m));let R=y.program;i.updateUBOMapping(g,R);let T=e.render.frame;s[g.id]!==T&&(d(g),s[g.id]=T)}function u(g){let y=h();g.__bindingPointIndex=y;let x=n.createBuffer(),R=g.__size,T=g.usage;return n.bindBuffer(n.UNIFORM_BUFFER,x),n.bufferData(n.UNIFORM_BUFFER,R,T),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,y,x),x}function h(){for(let g=0;g<a;g++)if(o.indexOf(g)===-1)return o.push(g),g;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(g){let y=r[g.id],x=g.uniforms,R=g.__cache;n.bindBuffer(n.UNIFORM_BUFFER,y);for(let T=0,b=x.length;T<b;T++){let C=Array.isArray(x[T])?x[T]:[x[T]];for(let E=0,M=C.length;E<M;E++){let L=C[E];if(p(L,T,E,R)===!0){let U=L.__offset,I=Array.isArray(L.value)?L.value:[L.value],H=0;for(let Y=0;Y<I.length;Y++){let q=I[Y],te=_(q);typeof q=="number"||typeof q=="boolean"?(L.__data[0]=q,n.bufferSubData(n.UNIFORM_BUFFER,U+H,L.__data)):q.isMatrix3?(L.__data[0]=q.elements[0],L.__data[1]=q.elements[1],L.__data[2]=q.elements[2],L.__data[3]=0,L.__data[4]=q.elements[3],L.__data[5]=q.elements[4],L.__data[6]=q.elements[5],L.__data[7]=0,L.__data[8]=q.elements[6],L.__data[9]=q.elements[7],L.__data[10]=q.elements[8],L.__data[11]=0):(q.toArray(L.__data,H),H+=te.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,U,L.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function p(g,y,x,R){let T=g.value,b=y+"_"+x;if(R[b]===void 0)return typeof T=="number"||typeof T=="boolean"?R[b]=T:R[b]=T.clone(),!0;{let C=R[b];if(typeof T=="number"||typeof T=="boolean"){if(C!==T)return R[b]=T,!0}else if(C.equals(T)===!1)return C.copy(T),!0}return!1}function v(g){let y=g.uniforms,x=0,R=16;for(let b=0,C=y.length;b<C;b++){let E=Array.isArray(y[b])?y[b]:[y[b]];for(let M=0,L=E.length;M<L;M++){let U=E[M],I=Array.isArray(U.value)?U.value:[U.value];for(let H=0,Y=I.length;H<Y;H++){let q=I[H],te=_(q),k=x%R;k!==0&&R-k<te.boundary&&(x+=R-k),U.__data=new Float32Array(te.storage/Float32Array.BYTES_PER_ELEMENT),U.__offset=x,x+=te.storage}}}let T=x%R;return T>0&&(x+=R-T),g.__size=x,g.__cache={},this}function _(g){let y={boundary:0,storage:0};return typeof g=="number"||typeof g=="boolean"?(y.boundary=4,y.storage=4):g.isVector2?(y.boundary=8,y.storage=8):g.isVector3||g.isColor?(y.boundary=16,y.storage=12):g.isVector4?(y.boundary=16,y.storage=16):g.isMatrix3?(y.boundary=48,y.storage=48):g.isMatrix4?(y.boundary=64,y.storage=64):g.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",g),y}function m(g){let y=g.target;y.removeEventListener("dispose",m);let x=o.indexOf(y.__bindingPointIndex);o.splice(x,1),n.deleteBuffer(r[y.id]),delete r[y.id],delete s[y.id]}function f(){for(let g in r)n.deleteBuffer(r[g]);o=[],r={},s={}}return{bind:l,update:c,dispose:f}}var Ru=class{constructor(e={}){let{canvas:t=Yw(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:h=!1}=e;this.isWebGLRenderer=!0;let d;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");d=i.getContextAttributes().alpha}else d=o;let p=new Uint32Array(4),v=new Int32Array(4),_=null,m=null,f=[],g=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=wt,this._useLegacyLights=!1,this.toneMapping=wi,this.toneMappingExposure=1;let y=this,x=!1,R=0,T=0,b=null,C=-1,E=null,M=new ct,L=new ct,U=null,I=new we(0),H=0,Y=t.width,q=t.height,te=1,k=null,$=null,Q=new ct(0,0,Y,q),le=new ct(0,0,Y,q),be=!1,Te=new il,X=!1,re=!1,pe=new Ue,oe=new P,Pe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function ke(){return b===null?te:1}let F=i;function $e(A,O){return t.getContext(A,O)}try{let A={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine","three.js r164"),t.addEventListener("webglcontextlost",N,!1),t.addEventListener("webglcontextrestored",K,!1),t.addEventListener("webglcontextcreationerror",j,!1),F===null){let O="webgl2";if(F=$e(O,A),F===null)throw $e(O)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(A){throw console.error("THREE.WebGLRenderer: "+A.message),A}let ve,Je,_e,ye,Oe,Xe,ut,w,S,D,G,J,ee,Ae,de,he,Ne,se,Me,Ye,Ee,me,Re,Ie;function tt(){ve=new ib(F),ve.init(),me=new LR(F,ve),Je=new $A(F,ve,e,me),_e=new PR(F),ye=new ob(F),Oe=new yR,Xe=new IR(F,ve,_e,Oe,Je,me,ye),ut=new QA(y),w=new nb(y),S=new fE(F),Re=new KA(F,S),D=new rb(F,S,ye,Re),G=new lb(F,D,S,ye),Me=new ab(F,Je,Xe),he=new JA(Oe),J=new vR(y,ut,w,ve,Je,Re,he),ee=new FR(y,Oe),Ae=new xR,de=new AR(ve),se=new jA(y,ut,w,_e,G,d,l),Ne=new CR(y,G,Je),Ie=new kR(F,ye,Je,_e),Ye=new ZA(F,ve,ye),Ee=new sb(F,ve,ye),ye.programs=J.programs,y.capabilities=Je,y.extensions=ve,y.properties=Oe,y.renderLists=Ae,y.shadowMap=Ne,y.state=_e,y.info=ye}tt();let Fe=new Fp(y,F);this.xr=Fe,this.getContext=function(){return F},this.getContextAttributes=function(){return F.getContextAttributes()},this.forceContextLoss=function(){let A=ve.get("WEBGL_lose_context");A&&A.loseContext()},this.forceContextRestore=function(){let A=ve.get("WEBGL_lose_context");A&&A.restoreContext()},this.getPixelRatio=function(){return te},this.setPixelRatio=function(A){A!==void 0&&(te=A,this.setSize(Y,q,!1))},this.getSize=function(A){return A.set(Y,q)},this.setSize=function(A,O,W=!0){if(Fe.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}Y=A,q=O,t.width=Math.floor(A*te),t.height=Math.floor(O*te),W===!0&&(t.style.width=A+"px",t.style.height=O+"px"),this.setViewport(0,0,A,O)},this.getDrawingBufferSize=function(A){return A.set(Y*te,q*te).floor()},this.setDrawingBufferSize=function(A,O,W){Y=A,q=O,te=W,t.width=Math.floor(A*W),t.height=Math.floor(O*W),this.setViewport(0,0,A,O)},this.getCurrentViewport=function(A){return A.copy(M)},this.getViewport=function(A){return A.copy(Q)},this.setViewport=function(A,O,W,z){A.isVector4?Q.set(A.x,A.y,A.z,A.w):Q.set(A,O,W,z),_e.viewport(M.copy(Q).multiplyScalar(te).round())},this.getScissor=function(A){return A.copy(le)},this.setScissor=function(A,O,W,z){A.isVector4?le.set(A.x,A.y,A.z,A.w):le.set(A,O,W,z),_e.scissor(L.copy(le).multiplyScalar(te).round())},this.getScissorTest=function(){return be},this.setScissorTest=function(A){_e.setScissorTest(be=A)},this.setOpaqueSort=function(A){k=A},this.setTransparentSort=function(A){$=A},this.getClearColor=function(A){return A.copy(se.getClearColor())},this.setClearColor=function(){se.setClearColor.apply(se,arguments)},this.getClearAlpha=function(){return se.getClearAlpha()},this.setClearAlpha=function(){se.setClearAlpha.apply(se,arguments)},this.clear=function(A=!0,O=!0,W=!0){let z=0;if(A){let B=!1;if(b!==null){let fe=b.texture.format;B=fe===Sx||fe===Mx||fe===xx}if(B){let fe=b.texture.type,xe=fe===Nr||fe===Ro||fe===mx||fe===dl||fe===vx||fe===yx,Se=se.getClearColor(),Ce=se.getClearAlpha(),ze=Se.r,Ve=Se.g,qe=Se.b;xe?(p[0]=ze,p[1]=Ve,p[2]=qe,p[3]=Ce,F.clearBufferuiv(F.COLOR,0,p)):(v[0]=ze,v[1]=Ve,v[2]=qe,v[3]=Ce,F.clearBufferiv(F.COLOR,0,v))}else z|=F.COLOR_BUFFER_BIT}O&&(z|=F.DEPTH_BUFFER_BIT),W&&(z|=F.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),F.clear(z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",N,!1),t.removeEventListener("webglcontextrestored",K,!1),t.removeEventListener("webglcontextcreationerror",j,!1),Ae.dispose(),de.dispose(),Oe.dispose(),ut.dispose(),w.dispose(),G.dispose(),Re.dispose(),Ie.dispose(),J.dispose(),Fe.dispose(),Fe.removeEventListener("sessionstart",We),Fe.removeEventListener("sessionend",Vt),vt.stop()};function N(A){A.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),x=!0}function K(){console.log("THREE.WebGLRenderer: Context Restored."),x=!1;let A=ye.autoReset,O=Ne.enabled,W=Ne.autoUpdate,z=Ne.needsUpdate,B=Ne.type;tt(),ye.autoReset=A,Ne.enabled=O,Ne.autoUpdate=W,Ne.needsUpdate=z,Ne.type=B}function j(A){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",A.statusMessage)}function ae(A){let O=A.target;O.removeEventListener("dispose",ae),ce(O)}function ce(A){De(A),Oe.remove(A)}function De(A){let O=Oe.get(A).programs;O!==void 0&&(O.forEach(function(W){J.releaseProgram(W)}),A.isShaderMaterial&&J.releaseShaderCache(A))}this.renderBufferDirect=function(A,O,W,z,B,fe){O===null&&(O=Pe);let xe=B.isMesh&&B.matrixWorld.determinant()<0,Se=Qx(A,O,W,z,B);_e.setMaterial(z,xe);let Ce=W.index,ze=1;if(z.wireframe===!0){if(Ce=D.getWireframeAttribute(W),Ce===void 0)return;ze=2}let Ve=W.drawRange,qe=W.attributes.position,It=Ve.start*ze,Jt=(Ve.start+Ve.count)*ze;fe!==null&&(It=Math.max(It,fe.start*ze),Jt=Math.min(Jt,(fe.start+fe.count)*ze)),Ce!==null?(It=Math.max(It,0),Jt=Math.min(Jt,Ce.count)):qe!=null&&(It=Math.max(It,0),Jt=Math.min(Jt,qe.count));let Cn=Jt-It;if(Cn<0||Cn===1/0)return;Re.setup(B,z,Se,W,Ce);let bi,rt=Ye;if(Ce!==null&&(bi=S.get(Ce),rt=Ee,rt.setIndex(bi)),B.isMesh)z.wireframe===!0?(_e.setLineWidth(z.wireframeLinewidth*ke()),rt.setMode(F.LINES)):rt.setMode(F.TRIANGLES);else if(B.isLine){let Be=z.linewidth;Be===void 0&&(Be=1),_e.setLineWidth(Be*ke()),B.isLineSegments?rt.setMode(F.LINES):B.isLineLoop?rt.setMode(F.LINE_LOOP):rt.setMode(F.LINE_STRIP)}else B.isPoints?rt.setMode(F.POINTS):B.isSprite&&rt.setMode(F.TRIANGLES);if(B.isBatchedMesh)B._multiDrawInstances!==null?rt.renderMultiDrawInstances(B._multiDrawStarts,B._multiDrawCounts,B._multiDrawCount,B._multiDrawInstances):rt.renderMultiDraw(B._multiDrawStarts,B._multiDrawCounts,B._multiDrawCount);else if(B.isInstancedMesh)rt.renderInstances(It,Cn,B.count);else if(W.isInstancedBufferGeometry){let Be=W._maxInstanceCount!==void 0?W._maxInstanceCount:1/0,Xo=Math.min(W.instanceCount,Be);rt.renderInstances(It,Cn,Xo)}else rt.render(It,Cn)};function Ke(A,O,W){A.transparent===!0&&A.side===yn&&A.forceSinglePass===!1?(A.side=Xt,A.needsUpdate=!0,tr(A,O,W),A.side=Zn,A.needsUpdate=!0,tr(A,O,W),A.side=yn):tr(A,O,W)}this.compile=function(A,O,W=null){W===null&&(W=A),m=de.get(W),m.init(O),g.push(m),W.traverseVisible(function(B){B.isLight&&B.layers.test(O.layers)&&(m.pushLight(B),B.castShadow&&m.pushShadow(B))}),A!==W&&A.traverseVisible(function(B){B.isLight&&B.layers.test(O.layers)&&(m.pushLight(B),B.castShadow&&m.pushShadow(B))}),m.setupLights(y._useLegacyLights);let z=new Set;return A.traverse(function(B){let fe=B.material;if(fe)if(Array.isArray(fe))for(let xe=0;xe<fe.length;xe++){let Se=fe[xe];Ke(Se,W,B),z.add(Se)}else Ke(fe,W,B),z.add(fe)}),g.pop(),m=null,z},this.compileAsync=function(A,O,W=null){let z=this.compile(A,O,W);return new Promise(B=>{function fe(){if(z.forEach(function(xe){Oe.get(xe).currentProgram.isReady()&&z.delete(xe)}),z.size===0){B(A);return}setTimeout(fe,10)}ve.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let it=null;function gt(A){it&&it(A)}function We(){vt.stop()}function Vt(){vt.start()}let vt=new Px;vt.setAnimationLoop(gt),typeof self<"u"&&vt.setContext(self),this.setAnimationLoop=function(A){it=A,Fe.setAnimationLoop(A),A===null?vt.stop():vt.start()},Fe.addEventListener("sessionstart",We),Fe.addEventListener("sessionend",Vt),this.render=function(A,O){if(O!==void 0&&O.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(x===!0)return;A.matrixWorldAutoUpdate===!0&&A.updateMatrixWorld(),O.parent===null&&O.matrixWorldAutoUpdate===!0&&O.updateMatrixWorld(),Fe.enabled===!0&&Fe.isPresenting===!0&&(Fe.cameraAutoUpdate===!0&&Fe.updateCamera(O),O=Fe.getCamera()),A.isScene===!0&&A.onBeforeRender(y,A,O,b),m=de.get(A,g.length),m.init(O),g.push(m),pe.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),Te.setFromProjectionMatrix(pe),re=this.localClippingEnabled,X=he.init(this.clippingPlanes,re),_=Ae.get(A,f.length),_.init(),f.push(_),Pt(A,O,0,y.sortObjects),_.finish(),y.sortObjects===!0&&_.sort(k,$);let W=Fe.enabled===!1||Fe.isPresenting===!1||Fe.hasDepthSensing()===!1;W&&se.addToRenderList(_,A),this.info.render.frame++,X===!0&&he.beginShadows();let z=m.state.shadowsArray;Ne.render(z,A,O),X===!0&&he.endShadows(),this.info.autoReset===!0&&this.info.reset();let B=_.opaque,fe=_.transmissive;if(m.setupLights(y._useLegacyLights),O.isArrayCamera){let xe=O.cameras;if(fe.length>0)for(let Se=0,Ce=xe.length;Se<Ce;Se++){let ze=xe[Se];fi(B,fe,A,ze)}W&&se.render(A);for(let Se=0,Ce=xe.length;Se<Ce;Se++){let ze=xe[Se];xn(_,A,ze,ze.viewport)}}else fe.length>0&&fi(B,fe,A,O),W&&se.render(A),xn(_,A,O);b!==null&&(Xe.updateMultisampleRenderTarget(b),Xe.updateRenderTargetMipmap(b)),A.isScene===!0&&A.onAfterRender(y,A,O),Re.resetDefaultState(),C=-1,E=null,g.pop(),g.length>0?(m=g[g.length-1],X===!0&&he.setGlobalState(y.clippingPlanes,m.state.camera)):m=null,f.pop(),f.length>0?_=f[f.length-1]:_=null};function Pt(A,O,W,z){if(A.visible===!1)return;if(A.layers.test(O.layers)){if(A.isGroup)W=A.renderOrder;else if(A.isLOD)A.autoUpdate===!0&&A.update(O);else if(A.isLight)m.pushLight(A),A.castShadow&&m.pushShadow(A);else if(A.isSprite){if(!A.frustumCulled||Te.intersectsSprite(A)){z&&oe.setFromMatrixPosition(A.matrixWorld).applyMatrix4(pe);let xe=G.update(A),Se=A.material;Se.visible&&_.push(A,xe,Se,W,oe.z,null)}}else if((A.isMesh||A.isLine||A.isPoints)&&(!A.frustumCulled||Te.intersectsObject(A))){let xe=G.update(A),Se=A.material;if(z&&(A.boundingSphere!==void 0?(A.boundingSphere===null&&A.computeBoundingSphere(),oe.copy(A.boundingSphere.center)):(xe.boundingSphere===null&&xe.computeBoundingSphere(),oe.copy(xe.boundingSphere.center)),oe.applyMatrix4(A.matrixWorld).applyMatrix4(pe)),Array.isArray(Se)){let Ce=xe.groups;for(let ze=0,Ve=Ce.length;ze<Ve;ze++){let qe=Ce[ze],It=Se[qe.materialIndex];It&&It.visible&&_.push(A,xe,It,W,oe.z,qe)}}else Se.visible&&_.push(A,xe,Se,W,oe.z,null)}}let fe=A.children;for(let xe=0,Se=fe.length;xe<Se;xe++)Pt(fe[xe],O,W,z)}function xn(A,O,W,z){let B=A.opaque,fe=A.transmissive,xe=A.transparent;m.setupLightsView(W),X===!0&&he.setGlobalState(y.clippingPlanes,W),z&&_e.viewport(M.copy(z)),B.length>0&&Hr(B,O,W),fe.length>0&&Hr(fe,O,W),xe.length>0&&Hr(xe,O,W),_e.buffers.depth.setTest(!0),_e.buffers.depth.setMask(!0),_e.buffers.color.setMask(!0),_e.setPolygonOffset(!1)}function fi(A,O,W,z){if((W.isScene===!0?W.overrideMaterial:null)!==null)return;m.state.transmissionRenderTarget[z.id]===void 0&&(m.state.transmissionRenderTarget[z.id]=new Zi(1,1,{generateMipmaps:!0,type:ve.has("EXT_color_buffer_half_float")||ve.has("EXT_color_buffer_float")?Zu:Nr,minFilter:Mi,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1}));let fe=m.state.transmissionRenderTarget[z.id],xe=z.viewport||M;fe.setSize(xe.z,xe.w);let Se=y.getRenderTarget();y.setRenderTarget(fe),y.getClearColor(I),H=y.getClearAlpha(),H<1&&y.setClearColor(16777215,.5),y.clear();let Ce=y.toneMapping;y.toneMapping=wi;let ze=z.viewport;if(z.viewport!==void 0&&(z.viewport=void 0),m.setupLightsView(z),X===!0&&he.setGlobalState(y.clippingPlanes,z),Hr(A,W,z),Xe.updateMultisampleRenderTarget(fe),Xe.updateRenderTargetMipmap(fe),ve.has("WEBGL_multisampled_render_to_texture")===!1){let Ve=!1;for(let qe=0,It=O.length;qe<It;qe++){let Jt=O[qe],Cn=Jt.object,bi=Jt.geometry,rt=Jt.material,Be=Jt.group;if(rt.side===yn&&Cn.layers.test(z.layers)){let Xo=rt.side;rt.side=Xt,rt.needsUpdate=!0,_s(Cn,W,z,bi,rt,Be),rt.side=Xo,rt.needsUpdate=!0,Ve=!0}}Ve===!0&&(Xe.updateMultisampleRenderTarget(fe),Xe.updateRenderTargetMipmap(fe))}y.setRenderTarget(Se),y.setClearColor(I,H),ze!==void 0&&(z.viewport=ze),y.toneMapping=Ce}function Hr(A,O,W){let z=O.isScene===!0?O.overrideMaterial:null;for(let B=0,fe=A.length;B<fe;B++){let xe=A[B],Se=xe.object,Ce=xe.geometry,ze=z===null?xe.material:z,Ve=xe.group;Se.layers.test(W.layers)&&_s(Se,O,W,Ce,ze,Ve)}}function _s(A,O,W,z,B,fe){A.onBeforeRender(y,O,W,z,B,fe),A.modelViewMatrix.multiplyMatrices(W.matrixWorldInverse,A.matrixWorld),A.normalMatrix.getNormalMatrix(A.modelViewMatrix),B.onBeforeRender(y,O,W,z,A,fe),B.transparent===!0&&B.side===yn&&B.forceSinglePass===!1?(B.side=Xt,B.needsUpdate=!0,y.renderBufferDirect(W,O,z,B,A,fe),B.side=Zn,B.needsUpdate=!0,y.renderBufferDirect(W,O,z,B,A,fe),B.side=yn):y.renderBufferDirect(W,O,z,B,A,fe),A.onAfterRender(y,O,W,z,B,fe)}function tr(A,O,W){O.isScene!==!0&&(O=Pe);let z=Oe.get(A),B=m.state.lights,fe=m.state.shadowsArray,xe=B.state.version,Se=J.getParameters(A,B.state,fe,O,W),Ce=J.getProgramCacheKey(Se),ze=z.programs;z.environment=A.isMeshStandardMaterial?O.environment:null,z.fog=O.fog,z.envMap=(A.isMeshStandardMaterial?w:ut).get(A.envMap||z.environment),z.envMapRotation=z.environment!==null&&A.envMap===null?O.environmentRotation:A.envMapRotation,ze===void 0&&(A.addEventListener("dispose",ae),ze=new Map,z.programs=ze);let Ve=ze.get(Ce);if(Ve!==void 0){if(z.currentProgram===Ve&&z.lightsStateVersion===xe)return Hm(A,Se),Ve}else Se.uniforms=J.getUniforms(A),A.onBuild(W,Se,y),A.onBeforeCompile(Se,y),Ve=J.acquireProgram(Se,Ce),ze.set(Ce,Ve),z.uniforms=Se.uniforms;let qe=z.uniforms;return(!A.isShaderMaterial&&!A.isRawShaderMaterial||A.clipping===!0)&&(qe.clippingPlanes=he.uniform),Hm(A,Se),z.needsLights=tM(A),z.lightsStateVersion=xe,z.needsLights&&(qe.ambientLightColor.value=B.state.ambient,qe.lightProbe.value=B.state.probe,qe.directionalLights.value=B.state.directional,qe.directionalLightShadows.value=B.state.directionalShadow,qe.spotLights.value=B.state.spot,qe.spotLightShadows.value=B.state.spotShadow,qe.rectAreaLights.value=B.state.rectArea,qe.ltc_1.value=B.state.rectAreaLTC1,qe.ltc_2.value=B.state.rectAreaLTC2,qe.pointLights.value=B.state.point,qe.pointLightShadows.value=B.state.pointShadow,qe.hemisphereLights.value=B.state.hemi,qe.directionalShadowMap.value=B.state.directionalShadowMap,qe.directionalShadowMatrix.value=B.state.directionalShadowMatrix,qe.spotShadowMap.value=B.state.spotShadowMap,qe.spotLightMatrix.value=B.state.spotLightMatrix,qe.spotLightMap.value=B.state.spotLightMap,qe.pointShadowMap.value=B.state.pointShadowMap,qe.pointShadowMatrix.value=B.state.pointShadowMatrix),z.currentProgram=Ve,z.uniformsList=null,Ve}function xs(A){if(A.uniformsList===null){let O=A.currentProgram.getUniforms();A.uniformsList=To.seqWithValue(O.seq,A.uniforms)}return A.uniformsList}function Hm(A,O){let W=Oe.get(A);W.outputColorSpace=O.outputColorSpace,W.batching=O.batching,W.instancing=O.instancing,W.instancingColor=O.instancingColor,W.instancingMorph=O.instancingMorph,W.skinning=O.skinning,W.morphTargets=O.morphTargets,W.morphNormals=O.morphNormals,W.morphColors=O.morphColors,W.morphTargetsCount=O.morphTargetsCount,W.numClippingPlanes=O.numClippingPlanes,W.numIntersection=O.numClipIntersection,W.vertexAlphas=O.vertexAlphas,W.vertexTangents=O.vertexTangents,W.toneMapping=O.toneMapping}function Qx(A,O,W,z,B){O.isScene!==!0&&(O=Pe),Xe.resetTextureUnits();let fe=O.fog,xe=z.isMeshStandardMaterial?O.environment:null,Se=b===null?y.outputColorSpace:b.isXRRenderTarget===!0?b.texture.colorSpace:jt,Ce=(z.isMeshStandardMaterial?w:ut).get(z.envMap||xe),ze=z.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,Ve=!!W.attributes.tangent&&(!!z.normalMap||z.anisotropy>0),qe=!!W.morphAttributes.position,It=!!W.morphAttributes.normal,Jt=!!W.morphAttributes.color,Cn=wi;z.toneMapped&&(b===null||b.isXRRenderTarget===!0)&&(Cn=y.toneMapping);let bi=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,rt=bi!==void 0?bi.length:0,Be=Oe.get(z),Xo=m.state.lights;if(X===!0&&(re===!0||A!==E)){let Vn=A===E&&z.id===C;he.setState(z,A,Vn)}let yt=!1;z.version===Be.__version?(Be.needsLights&&Be.lightsStateVersion!==Xo.state.version||Be.outputColorSpace!==Se||B.isBatchedMesh&&Be.batching===!1||!B.isBatchedMesh&&Be.batching===!0||B.isInstancedMesh&&Be.instancing===!1||!B.isInstancedMesh&&Be.instancing===!0||B.isSkinnedMesh&&Be.skinning===!1||!B.isSkinnedMesh&&Be.skinning===!0||B.isInstancedMesh&&Be.instancingColor===!0&&B.instanceColor===null||B.isInstancedMesh&&Be.instancingColor===!1&&B.instanceColor!==null||B.isInstancedMesh&&Be.instancingMorph===!0&&B.morphTexture===null||B.isInstancedMesh&&Be.instancingMorph===!1&&B.morphTexture!==null||Be.envMap!==Ce||z.fog===!0&&Be.fog!==fe||Be.numClippingPlanes!==void 0&&(Be.numClippingPlanes!==he.numPlanes||Be.numIntersection!==he.numIntersection)||Be.vertexAlphas!==ze||Be.vertexTangents!==Ve||Be.morphTargets!==qe||Be.morphNormals!==It||Be.morphColors!==Jt||Be.toneMapping!==Cn||Be.morphTargetsCount!==rt)&&(yt=!0):(yt=!0,Be.__version=z.version);let Gr=Be.currentProgram;yt===!0&&(Gr=tr(z,O,B));let Gm=!1,qo=!1,dh=!1,Qt=Gr.getUniforms(),nr=Be.uniforms;if(_e.useProgram(Gr.program)&&(Gm=!0,qo=!0,dh=!0),z.id!==C&&(C=z.id,qo=!0),Gm||E!==A){Qt.setValue(F,"projectionMatrix",A.projectionMatrix),Qt.setValue(F,"viewMatrix",A.matrixWorldInverse);let Vn=Qt.map.cameraPosition;Vn!==void 0&&Vn.setValue(F,oe.setFromMatrixPosition(A.matrixWorld)),Je.logarithmicDepthBuffer&&Qt.setValue(F,"logDepthBufFC",2/(Math.log(A.far+1)/Math.LN2)),(z.isMeshPhongMaterial||z.isMeshToonMaterial||z.isMeshLambertMaterial||z.isMeshBasicMaterial||z.isMeshStandardMaterial||z.isShaderMaterial)&&Qt.setValue(F,"isOrthographic",A.isOrthographicCamera===!0),E!==A&&(E=A,qo=!0,dh=!0)}if(B.isSkinnedMesh){Qt.setOptional(F,B,"bindMatrix"),Qt.setOptional(F,B,"bindMatrixInverse");let Vn=B.skeleton;Vn&&(Vn.boneTexture===null&&Vn.computeBoneTexture(),Qt.setValue(F,"boneTexture",Vn.boneTexture,Xe))}B.isBatchedMesh&&(Qt.setOptional(F,B,"batchingTexture"),Qt.setValue(F,"batchingTexture",B._matricesTexture,Xe));let fh=W.morphAttributes;if((fh.position!==void 0||fh.normal!==void 0||fh.color!==void 0)&&Me.update(B,W,Gr),(qo||Be.receiveShadow!==B.receiveShadow)&&(Be.receiveShadow=B.receiveShadow,Qt.setValue(F,"receiveShadow",B.receiveShadow)),z.isMeshGouraudMaterial&&z.envMap!==null&&(nr.envMap.value=Ce,nr.flipEnvMap.value=Ce.isCubeTexture&&Ce.isRenderTargetTexture===!1?-1:1),z.isMeshStandardMaterial&&z.envMap===null&&O.environment!==null&&(nr.envMapIntensity.value=O.environmentIntensity),qo&&(Qt.setValue(F,"toneMappingExposure",y.toneMappingExposure),Be.needsLights&&eM(nr,dh),fe&&z.fog===!0&&ee.refreshFogUniforms(nr,fe),ee.refreshMaterialUniforms(nr,z,te,q,m.state.transmissionRenderTarget[A.id]),To.upload(F,xs(Be),nr,Xe)),z.isShaderMaterial&&z.uniformsNeedUpdate===!0&&(To.upload(F,xs(Be),nr,Xe),z.uniformsNeedUpdate=!1),z.isSpriteMaterial&&Qt.setValue(F,"center",B.center),Qt.setValue(F,"modelViewMatrix",B.modelViewMatrix),Qt.setValue(F,"normalMatrix",B.normalMatrix),Qt.setValue(F,"modelMatrix",B.matrixWorld),z.isShaderMaterial||z.isRawShaderMaterial){let Vn=z.uniformsGroups;for(let ph=0,nM=Vn.length;ph<nM;ph++){let Wm=Vn[ph];Ie.update(Wm,Gr),Ie.bind(Wm,Gr)}}return Gr}function eM(A,O){A.ambientLightColor.needsUpdate=O,A.lightProbe.needsUpdate=O,A.directionalLights.needsUpdate=O,A.directionalLightShadows.needsUpdate=O,A.pointLights.needsUpdate=O,A.pointLightShadows.needsUpdate=O,A.spotLights.needsUpdate=O,A.spotLightShadows.needsUpdate=O,A.rectAreaLights.needsUpdate=O,A.hemisphereLights.needsUpdate=O}function tM(A){return A.isMeshLambertMaterial||A.isMeshToonMaterial||A.isMeshPhongMaterial||A.isMeshStandardMaterial||A.isShadowMaterial||A.isShaderMaterial&&A.lights===!0}this.getActiveCubeFace=function(){return R},this.getActiveMipmapLevel=function(){return T},this.getRenderTarget=function(){return b},this.setRenderTargetTextures=function(A,O,W){Oe.get(A.texture).__webglTexture=O,Oe.get(A.depthTexture).__webglTexture=W;let z=Oe.get(A);z.__hasExternalTextures=!0,z.__autoAllocateDepthBuffer=W===void 0,z.__autoAllocateDepthBuffer||ve.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),z.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(A,O){let W=Oe.get(A);W.__webglFramebuffer=O,W.__useDefaultFramebuffer=O===void 0},this.setRenderTarget=function(A,O=0,W=0){b=A,R=O,T=W;let z=!0,B=null,fe=!1,xe=!1;if(A){let Ce=Oe.get(A);Ce.__useDefaultFramebuffer!==void 0?(_e.bindFramebuffer(F.FRAMEBUFFER,null),z=!1):Ce.__webglFramebuffer===void 0?Xe.setupRenderTarget(A):Ce.__hasExternalTextures&&Xe.rebindTextures(A,Oe.get(A.texture).__webglTexture,Oe.get(A.depthTexture).__webglTexture);let ze=A.texture;(ze.isData3DTexture||ze.isDataArrayTexture||ze.isCompressedArrayTexture)&&(xe=!0);let Ve=Oe.get(A).__webglFramebuffer;A.isWebGLCubeRenderTarget?(Array.isArray(Ve[O])?B=Ve[O][W]:B=Ve[O],fe=!0):A.samples>0&&Xe.useMultisampledRTT(A)===!1?B=Oe.get(A).__webglMultisampledFramebuffer:Array.isArray(Ve)?B=Ve[W]:B=Ve,M.copy(A.viewport),L.copy(A.scissor),U=A.scissorTest}else M.copy(Q).multiplyScalar(te).floor(),L.copy(le).multiplyScalar(te).floor(),U=be;if(_e.bindFramebuffer(F.FRAMEBUFFER,B)&&z&&_e.drawBuffers(A,B),_e.viewport(M),_e.scissor(L),_e.setScissorTest(U),fe){let Ce=Oe.get(A.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_CUBE_MAP_POSITIVE_X+O,Ce.__webglTexture,W)}else if(xe){let Ce=Oe.get(A.texture),ze=O||0;F.framebufferTextureLayer(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,Ce.__webglTexture,W||0,ze)}C=-1},this.readRenderTargetPixels=function(A,O,W,z,B,fe,xe){if(!(A&&A.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Se=Oe.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&xe!==void 0&&(Se=Se[xe]),Se){_e.bindFramebuffer(F.FRAMEBUFFER,Se);try{let Ce=A.texture,ze=Ce.format,Ve=Ce.type;if(!Je.textureFormatReadable(ze)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Je.textureTypeReadable(Ve)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}O>=0&&O<=A.width-z&&W>=0&&W<=A.height-B&&F.readPixels(O,W,z,B,me.convert(ze),me.convert(Ve),fe)}finally{let Ce=b!==null?Oe.get(b).__webglFramebuffer:null;_e.bindFramebuffer(F.FRAMEBUFFER,Ce)}}},this.copyFramebufferToTexture=function(A,O,W=0){let z=Math.pow(2,-W),B=Math.floor(O.image.width*z),fe=Math.floor(O.image.height*z);Xe.setTexture2D(O,0),F.copyTexSubImage2D(F.TEXTURE_2D,W,0,0,A.x,A.y,B,fe),_e.unbindTexture()},this.copyTextureToTexture=function(A,O,W,z=0){let B=O.image.width,fe=O.image.height,xe=me.convert(W.format),Se=me.convert(W.type);Xe.setTexture2D(W,0),F.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,W.flipY),F.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,W.premultiplyAlpha),F.pixelStorei(F.UNPACK_ALIGNMENT,W.unpackAlignment),O.isDataTexture?F.texSubImage2D(F.TEXTURE_2D,z,A.x,A.y,B,fe,xe,Se,O.image.data):O.isCompressedTexture?F.compressedTexSubImage2D(F.TEXTURE_2D,z,A.x,A.y,O.mipmaps[0].width,O.mipmaps[0].height,xe,O.mipmaps[0].data):F.texSubImage2D(F.TEXTURE_2D,z,A.x,A.y,xe,Se,O.image),z===0&&W.generateMipmaps&&F.generateMipmap(F.TEXTURE_2D),_e.unbindTexture()},this.copyTextureToTexture3D=function(A,O,W,z,B=0){let fe=A.max.x-A.min.x,xe=A.max.y-A.min.y,Se=A.max.z-A.min.z,Ce=me.convert(z.format),ze=me.convert(z.type),Ve;if(z.isData3DTexture)Xe.setTexture3D(z,0),Ve=F.TEXTURE_3D;else if(z.isDataArrayTexture||z.isCompressedArrayTexture)Xe.setTexture2DArray(z,0),Ve=F.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}F.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,z.flipY),F.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,z.premultiplyAlpha),F.pixelStorei(F.UNPACK_ALIGNMENT,z.unpackAlignment);let qe=F.getParameter(F.UNPACK_ROW_LENGTH),It=F.getParameter(F.UNPACK_IMAGE_HEIGHT),Jt=F.getParameter(F.UNPACK_SKIP_PIXELS),Cn=F.getParameter(F.UNPACK_SKIP_ROWS),bi=F.getParameter(F.UNPACK_SKIP_IMAGES),rt=W.isCompressedTexture?W.mipmaps[B]:W.image;F.pixelStorei(F.UNPACK_ROW_LENGTH,rt.width),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,rt.height),F.pixelStorei(F.UNPACK_SKIP_PIXELS,A.min.x),F.pixelStorei(F.UNPACK_SKIP_ROWS,A.min.y),F.pixelStorei(F.UNPACK_SKIP_IMAGES,A.min.z),W.isDataTexture||W.isData3DTexture?F.texSubImage3D(Ve,B,O.x,O.y,O.z,fe,xe,Se,Ce,ze,rt.data):z.isCompressedArrayTexture?F.compressedTexSubImage3D(Ve,B,O.x,O.y,O.z,fe,xe,Se,Ce,rt.data):F.texSubImage3D(Ve,B,O.x,O.y,O.z,fe,xe,Se,Ce,ze,rt),F.pixelStorei(F.UNPACK_ROW_LENGTH,qe),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,It),F.pixelStorei(F.UNPACK_SKIP_PIXELS,Jt),F.pixelStorei(F.UNPACK_SKIP_ROWS,Cn),F.pixelStorei(F.UNPACK_SKIP_IMAGES,bi),B===0&&z.generateMipmaps&&F.generateMipmap(Ve),_e.unbindTexture()},this.initTexture=function(A){A.isCubeTexture?Xe.setTextureCube(A,0):A.isData3DTexture?Xe.setTexture3D(A,0):A.isDataArrayTexture||A.isCompressedArrayTexture?Xe.setTexture2DArray(A,0):Xe.setTexture2D(A,0),_e.unbindTexture()},this.resetState=function(){R=0,T=0,b=null,_e.reset(),Re.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return ji}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=e===nm?"display-p3":"srgb",t.unpackColorSpace=nt.workingColorSpace===Ju?"display-p3":"srgb"}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(e){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=e}},Cu=class n{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new we(e),this.density=t}clone(){return new n(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var Uo=class extends Tt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ei,this.environmentIntensity=1,this.environmentRotation=new Ei,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},rl=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Mp,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.version=0,this.uuid=di()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return bx("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let r=0,s=this.stride;r<s;r++)this.array[e+r]=t.array[i+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=di()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(t,this.stride);return i.setUsage(this.usage),i}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=di()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},gn=new P,sl=class n{constructor(e,t,i,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)gn.fromBufferAttribute(this,t),gn.applyMatrix4(e),this.setXYZ(t,gn.x,gn.y,gn.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)gn.fromBufferAttribute(this,t),gn.applyNormalMatrix(e),this.setXYZ(t,gn.x,gn.y,gn.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)gn.fromBufferAttribute(this,t),gn.transformDirection(e),this.setXYZ(t,gn.x,gn.y,gn.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=ui(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=at(i,this.array)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=at(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=at(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=at(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=at(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=ui(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=ui(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=ui(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=ui(t,this.array)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=at(t,this.array),i=at(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=at(t,this.array),i=at(i,this.array),r=at(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=at(t,this.array),i=at(i,this.array),r=at(r,this.array),s=at(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return new Ct(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new n(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}};var q_=new P,Y_=new ct,j_=new ct,zR=new P,K_=new Ue,lu=new P,dp=new kn,Z_=new Ue,fp=new $i,Pu=class extends st{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Py,this.bindMatrix=new Ue,this.bindMatrixInverse=new Ue,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new Rn),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,lu),this.boundingBox.expandByPoint(lu)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new kn),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,lu),this.boundingSphere.expandByPoint(lu)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let i=this.material,r=this.matrixWorld;i!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),dp.copy(this.boundingSphere),dp.applyMatrix4(r),e.ray.intersectsSphere(dp)!==!1&&(Z_.copy(r).invert(),fp.copy(e.ray).applyMatrix4(Z_),!(this.boundingBox!==null&&fp.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,fp)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new ct,t=this.geometry.attributes.skinWeight;for(let i=0,r=t.count;i<r;i++){e.fromBufferAttribute(t,i);let s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(i,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Py?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===aw?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let i=this.skeleton,r=this.geometry;Y_.fromBufferAttribute(r.attributes.skinIndex,e),j_.fromBufferAttribute(r.attributes.skinWeight,e),q_.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){let o=j_.getComponent(s);if(o!==0){let a=Y_.getComponent(s);K_.multiplyMatrices(i.bones[a].matrixWorld,i.boneInverses[a]),t.addScaledVector(zR.copy(q_).applyMatrix4(K_),o)}}return t.applyMatrix4(this.bindMatrixInverse)}},ol=class extends Tt{constructor(){super(),this.isBone=!0,this.type="Bone"}},Iu=class extends Dt{constructor(e=null,t=1,i=1,r,s,o,a,l,c=cn,u=cn,h,d){super(null,o,a,l,c,u,r,s,h,d),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},$_=new Ue,BR=new Ue,Lu=class n{constructor(e=[],t=[]){this.uuid=di(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new Ue)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let i=new Ue;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){let e=this.bones,t=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,o=e.length;s<o;s++){let a=e[s]?e[s].matrixWorld:BR;$_.multiplyMatrices(a,t[s]),$_.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new n(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let i=new Iu(t,e,e,hi,Si);return i.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=i,this}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){let r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,r=e.bones.length;i<r;i++){let s=e.bones[i],o=t[s];o===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),o=new ol),this.bones.push(o),this.boneInverses.push(new Ue().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){let e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,i=this.boneInverses;for(let r=0,s=t.length;r<s;r++){let o=t[r];e.bones.push(o.uuid);let a=i[r];e.boneInverses.push(a.toArray())}return e}},gs=class extends Ct{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},go=new Ue,J_=new Ue,cu=[],Q_=new Rn,VR=new Ue,Ga=new st,Wa=new kn,Nu=class extends st{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new gs(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,VR)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Rn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,go),Q_.copy(e.boundingBox).applyMatrix4(go),this.boundingBox.union(Q_)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new kn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,go),Wa.copy(e.boundingSphere).applyMatrix4(go),this.boundingSphere.union(Wa)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,o=e*s+1;for(let a=0;a<i.length;a++)i[a]=r[o+a]}raycast(e,t){let i=this.matrixWorld,r=this.count;if(Ga.geometry=this.geometry,Ga.material=this.material,Ga.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Wa.copy(this.boundingSphere),Wa.applyMatrix4(i),e.ray.intersectsSphere(Wa)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,go),J_.multiplyMatrices(i,go),Ga.matrixWorld=J_,Ga.raycast(e,cu);for(let o=0,a=cu.length;o<a;o++){let l=cu[o];l.instanceId=s,l.object=this,t.push(l)}cu.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new gs(new Float32Array(this.instanceMatrix.count*3),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){let i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new Iu(new Float32Array(r*this.count),r,this.count,_x,Si));let s=this.morphTexture.source.data.data,o=0;for(let c=0;c<i.length;c++)o+=i[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=r*e;s[l]=a,s.set(i,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}};var al=class extends zn{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new we(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Du=new P,Uu=new P,ex=new Ue,Xa=new $i,uu=new kn,pp=new P,tx=new P,Oo=class extends Tt{constructor(e=new Yt,t=new al){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[0];for(let r=1,s=t.count;r<s;r++)Du.fromBufferAttribute(t,r-1),Uu.fromBufferAttribute(t,r),i[r]=i[r-1],i[r]+=Du.distanceTo(Uu);e.setAttribute("lineDistance",new Et(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let i=this.geometry,r=this.matrixWorld,s=e.params.Line.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),uu.copy(i.boundingSphere),uu.applyMatrix4(r),uu.radius+=s,e.ray.intersectsSphere(uu)===!1)return;ex.copy(r).invert(),Xa.copy(e.ray).applyMatrix4(ex);let a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,u=i.index,d=i.attributes.position;if(u!==null){let p=Math.max(0,o.start),v=Math.min(u.count,o.start+o.count);for(let _=p,m=v-1;_<m;_+=c){let f=u.getX(_),g=u.getX(_+1),y=hu(this,e,Xa,l,f,g);y&&t.push(y)}if(this.isLineLoop){let _=u.getX(v-1),m=u.getX(p),f=hu(this,e,Xa,l,_,m);f&&t.push(f)}}else{let p=Math.max(0,o.start),v=Math.min(d.count,o.start+o.count);for(let _=p,m=v-1;_<m;_+=c){let f=hu(this,e,Xa,l,_,_+1);f&&t.push(f)}if(this.isLineLoop){let _=hu(this,e,Xa,l,v-1,p);_&&t.push(_)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}};function hu(n,e,t,i,r,s){let o=n.geometry.attributes.position;if(Du.fromBufferAttribute(o,r),Uu.fromBufferAttribute(o,s),t.distanceSqToSegment(Du,Uu,pp,tx)>i)return;pp.applyMatrix4(n.matrixWorld);let l=e.ray.origin.distanceTo(pp);if(!(l<e.near||l>e.far))return{distance:l,point:tx.clone().applyMatrix4(n.matrixWorld),index:r,face:null,faceIndex:null,object:n}}var nx=new P,ix=new P,Ou=class extends Oo{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[];for(let r=0,s=t.count;r<s;r+=2)nx.fromBufferAttribute(t,r),ix.fromBufferAttribute(t,r+1),i[r]=r===0?0:i[r-1],i[r+1]=i[r]+nx.distanceTo(ix);e.setAttribute("lineDistance",new Et(i,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},Fu=class extends Oo{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},ll=class extends zn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new we(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},rx=new Ue,kp=new $i,du=new kn,fu=new P,Dr=class extends Tt{constructor(e=new Yt,t=new ll){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let i=this.geometry,r=this.matrixWorld,s=e.params.Points.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),du.copy(i.boundingSphere),du.applyMatrix4(r),du.radius+=s,e.ray.intersectsSphere(du)===!1)return;rx.copy(r).invert(),kp.copy(e.ray).applyMatrix4(rx);let a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=i.index,h=i.attributes.position;if(c!==null){let d=Math.max(0,o.start),p=Math.min(c.count,o.start+o.count);for(let v=d,_=p;v<_;v++){let m=c.getX(v);fu.fromBufferAttribute(h,m),sx(fu,m,l,r,e,t,this)}}else{let d=Math.max(0,o.start),p=Math.min(h.count,o.start+o.count);for(let v=d,_=p;v<_;v++)fu.fromBufferAttribute(h,v),sx(fu,v,l,r,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){let a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}};function sx(n,e,t,i,r,s,o){let a=kp.distanceSqToPoint(n);if(a<t){let l=new P;kp.closestPointToPoint(n,l),l.applyMatrix4(i);let c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,object:o})}}var Fo=class extends Dt{constructor(e,t,i,r,s,o,a,l,c){super(e,t,i,r,s,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var zp=class n extends Yt{constructor(e=[],t=[],i=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:r};let s=[],o=[];a(r),c(i),u(),this.setAttribute("position",new Et(s,3)),this.setAttribute("normal",new Et(s.slice(),3)),this.setAttribute("uv",new Et(o,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function a(g){let y=new P,x=new P,R=new P;for(let T=0;T<t.length;T+=3)p(t[T+0],y),p(t[T+1],x),p(t[T+2],R),l(y,x,R,g)}function l(g,y,x,R){let T=R+1,b=[];for(let C=0;C<=T;C++){b[C]=[];let E=g.clone().lerp(x,C/T),M=y.clone().lerp(x,C/T),L=T-C;for(let U=0;U<=L;U++)U===0&&C===T?b[C][U]=E:b[C][U]=E.clone().lerp(M,U/L)}for(let C=0;C<T;C++)for(let E=0;E<2*(T-C)-1;E++){let M=Math.floor(E/2);E%2===0?(d(b[C][M+1]),d(b[C+1][M]),d(b[C][M])):(d(b[C][M+1]),d(b[C+1][M+1]),d(b[C+1][M]))}}function c(g){let y=new P;for(let x=0;x<s.length;x+=3)y.x=s[x+0],y.y=s[x+1],y.z=s[x+2],y.normalize().multiplyScalar(g),s[x+0]=y.x,s[x+1]=y.y,s[x+2]=y.z}function u(){let g=new P;for(let y=0;y<s.length;y+=3){g.x=s[y+0],g.y=s[y+1],g.z=s[y+2];let x=m(g)/2/Math.PI+.5,R=f(g)/Math.PI+.5;o.push(x,1-R)}v(),h()}function h(){for(let g=0;g<o.length;g+=6){let y=o[g+0],x=o[g+2],R=o[g+4],T=Math.max(y,x,R),b=Math.min(y,x,R);T>.9&&b<.1&&(y<.2&&(o[g+0]+=1),x<.2&&(o[g+2]+=1),R<.2&&(o[g+4]+=1))}}function d(g){s.push(g.x,g.y,g.z)}function p(g,y){let x=g*3;y.x=e[x+0],y.y=e[x+1],y.z=e[x+2]}function v(){let g=new P,y=new P,x=new P,R=new P,T=new Le,b=new Le,C=new Le;for(let E=0,M=0;E<s.length;E+=9,M+=6){g.set(s[E+0],s[E+1],s[E+2]),y.set(s[E+3],s[E+4],s[E+5]),x.set(s[E+6],s[E+7],s[E+8]),T.set(o[M+0],o[M+1]),b.set(o[M+2],o[M+3]),C.set(o[M+4],o[M+5]),R.copy(g).add(y).add(x).divideScalar(3);let L=m(R);_(T,M+0,g,L),_(b,M+2,y,L),_(C,M+4,x,L)}}function _(g,y,x,R){R<0&&g.x===1&&(o[y]=g.x-1),x.x===0&&x.z===0&&(o[y]=R/2/Math.PI+.5)}function m(g){return Math.atan2(g.z,-g.x)}function f(g){return Math.atan2(-g.y,Math.sqrt(g.x*g.x+g.z*g.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.vertices,e.indices,e.radius,e.details)}};var ku=class n extends zp{constructor(e=1,t=0){let i=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],r=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(i,r,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new n(e.radius,e.detail)}};var Ur=class n extends Yt{constructor(e=1,t=32,i=16,r=0,s=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:r,phiLength:s,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),i=Math.max(2,Math.floor(i));let l=Math.min(o+a,Math.PI),c=0,u=[],h=new P,d=new P,p=[],v=[],_=[],m=[];for(let f=0;f<=i;f++){let g=[],y=f/i,x=0;f===0&&o===0?x=.5/t:f===i&&l===Math.PI&&(x=-.5/t);for(let R=0;R<=t;R++){let T=R/t;h.x=-e*Math.cos(r+T*s)*Math.sin(o+y*a),h.y=e*Math.cos(o+y*a),h.z=e*Math.sin(r+T*s)*Math.sin(o+y*a),v.push(h.x,h.y,h.z),d.copy(h).normalize(),_.push(d.x,d.y,d.z),m.push(T+x,1-y),g.push(c++)}u.push(g)}for(let f=0;f<i;f++)for(let g=0;g<t;g++){let y=u[f][g+1],x=u[f][g],R=u[f+1][g],T=u[f+1][g+1];(f!==0||o>0)&&p.push(y,x,T),(f!==i-1||l<Math.PI)&&p.push(x,R,T)}this.setIndex(p),this.setAttribute("position",new Et(v,3)),this.setAttribute("normal",new Et(_,3)),this.setAttribute("uv",new Et(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}};var zu=class n extends Yt{constructor(e=1,t=.4,i=12,r=48,s=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:i,tubularSegments:r,arc:s},i=Math.floor(i),r=Math.floor(r);let o=[],a=[],l=[],c=[],u=new P,h=new P,d=new P;for(let p=0;p<=i;p++)for(let v=0;v<=r;v++){let _=v/r*s,m=p/i*Math.PI*2;h.x=(e+t*Math.cos(m))*Math.cos(_),h.y=(e+t*Math.cos(m))*Math.sin(_),h.z=t*Math.sin(m),a.push(h.x,h.y,h.z),u.x=e*Math.cos(_),u.y=e*Math.sin(_),d.subVectors(h,u).normalize(),l.push(d.x,d.y,d.z),c.push(v/r),c.push(p/i)}for(let p=1;p<=i;p++)for(let v=1;v<=r;v++){let _=(r+1)*p+v-1,m=(r+1)*(p-1)+v-1,f=(r+1)*(p-1)+v,g=(r+1)*p+v;o.push(_,m,g),o.push(m,f,g)}this.setIndex(o),this.setAttribute("position",new Et(a,3)),this.setAttribute("normal",new Et(l,3)),this.setAttribute("uv",new Et(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}};var Ti=class extends zn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new we(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new we(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ex,this.normalScale=new Le(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ei,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Bn=class extends Ti{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Le(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return ln(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new we(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new we(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new we(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};function pu(n,e,t){return!n||!t&&n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}function HR(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function GR(n){function e(r,s){return n[r]-n[s]}let t=n.length,i=new Array(t);for(let r=0;r!==t;++r)i[r]=r;return i.sort(e),i}function ox(n,e,t){let i=n.length,r=new n.constructor(i);for(let s=0,o=0;o!==i;++s){let a=t[s]*e;for(let l=0;l!==e;++l)r[o++]=n[a+l]}return r}function Ox(n,e,t,i){let r=1,s=n[0];for(;s!==void 0&&s[i]===void 0;)s=n[r++];if(s===void 0)return;let o=s[i];if(o!==void 0)if(Array.isArray(o))do o=s[i],o!==void 0&&(e.push(s.time),t.push.apply(t,o)),s=n[r++];while(s!==void 0);else if(o.toArray!==void 0)do o=s[i],o!==void 0&&(e.push(s.time),o.toArray(t,t.length)),s=n[r++];while(s!==void 0);else do o=s[i],o!==void 0&&(e.push(s.time),t.push(o)),s=n[r++];while(s!==void 0)}var Or=class{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,r=t[i],s=t[i-1];e:{t:{let o;n:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=t[++i],e<r)break t}o=t.length;break n}if(!(e>=s)){let a=t[1];e<a&&(i=2,s=a);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break t}o=i,i=0;break n}break e}for(;i<o;){let a=i+o>>>1;e<t[a]?o=a:i=a+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)t[o]=i[s+o];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},Bp=class extends Or{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:yo,endingEnd:yo}}intervalChanged_(e,t,i){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],l=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case _o:s=e,a=2*t-i;break;case gu:s=r.length-2,a=t+r[s]-r[s+1];break;default:s=e,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case _o:o=e,l=2*i-t;break;case gu:o=1,l=i+r[1]-r[0];break;default:o=e-1,l=t}let c=(i-t)*.5,u=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-i),this._offsetPrev=s*u,this._offsetNext=o*u}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=this._offsetPrev,h=this._offsetNext,d=this._weightPrev,p=this._weightNext,v=(i-t)/(r-t),_=v*v,m=_*v,f=-d*m+2*d*_-d*v,g=(1+d)*m+(-1.5-2*d)*_+(-.5+d)*v+1,y=(-1-p)*m+(1.5+p)*_+.5*v,x=p*m-p*_;for(let R=0;R!==a;++R)s[R]=f*o[u+R]+g*o[c+R]+y*o[l+R]+x*o[h+R];return s}},Bu=class extends Or{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=(i-t)/(r-t),h=1-u;for(let d=0;d!==a;++d)s[d]=o[c+d]*h+o[l+d]*u;return s}},Vp=class extends Or{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},$n=class{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=pu(t,this.TimeBufferType),this.values=pu(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:pu(e.times,Array),values:pu(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new Vp(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Bu(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Bp(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case Co:t=this.InterpolantFactoryMethodDiscrete;break;case ms:t=this.InterpolantFactoryMethodLinear;break;case Vf:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return console.warn("THREE.KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Co;case this.InterpolantFactoryMethodLinear:return ms;case this.InterpolantFactoryMethodSmooth:return Vf}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){let i=this.times,r=i.length,s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let l=i[a];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(r!==void 0&&HR(r))for(let a=0,l=r.length;a!==l;++a){let c=r[a];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===Vf,s=e.length-1,o=1;for(let a=1;a<s;++a){let l=!1,c=e[a],u=e[a+1];if(c!==u&&(a!==1||c!==e[0]))if(r)l=!0;else{let h=a*i,d=h-i,p=h+i;for(let v=0;v!==i;++v){let _=t[h+v];if(_!==t[d+v]||_!==t[p+v]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let h=a*i,d=o*i;for(let p=0;p!==i;++p)t[d+p]=t[h+p]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,l=o*i,c=0;c!==i;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};$n.prototype.TimeBufferType=Float32Array;$n.prototype.ValueBufferType=Float32Array;$n.prototype.DefaultInterpolation=ms;var Fr=class extends $n{};Fr.prototype.ValueTypeName="bool";Fr.prototype.ValueBufferType=Array;Fr.prototype.DefaultInterpolation=Co;Fr.prototype.InterpolantFactoryMethodLinear=void 0;Fr.prototype.InterpolantFactoryMethodSmooth=void 0;var Vu=class extends $n{};Vu.prototype.ValueTypeName="color";var Ji=class extends $n{};Ji.prototype.ValueTypeName="number";var Hp=class extends Or{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-t)/(r-t),c=e*a;for(let u=c+a;c!==u;c+=4)bn.slerpFlat(s,0,o,c-a,o,c,l);return s}},Ai=class extends $n{InterpolantFactoryMethodLinear(e){return new Hp(this.times,this.values,this.getValueSize(),e)}};Ai.prototype.ValueTypeName="quaternion";Ai.prototype.DefaultInterpolation=ms;Ai.prototype.InterpolantFactoryMethodSmooth=void 0;var kr=class extends $n{};kr.prototype.ValueTypeName="string";kr.prototype.ValueBufferType=Array;kr.prototype.DefaultInterpolation=Co;kr.prototype.InterpolantFactoryMethodLinear=void 0;kr.prototype.InterpolantFactoryMethodSmooth=void 0;var Qi=class extends $n{};Qi.prototype.ValueTypeName="vector";var ko=class{constructor(e="",t=-1,i=[],r=tm){this.name=e,this.tracks=i,this.duration=t,this.blendMode=r,this.uuid=di(),this.duration<0&&this.resetDuration()}static parse(e){let t=[],i=e.tracks,r=1/(e.fps||1);for(let o=0,a=i.length;o!==a;++o)t.push(XR(i[o]).scale(r));let s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s}static toJSON(e){let t=[],i=e.tracks,r={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let s=0,o=i.length;s!==o;++s)t.push($n.toJSON(i[s]));return r}static CreateFromMorphTargetSequence(e,t,i,r){let s=t.length,o=[];for(let a=0;a<s;a++){let l=[],c=[];l.push((a+s-1)%s,a,(a+1)%s),c.push(0,1,0);let u=GR(l);l=ox(l,1,u),c=ox(c,1,u),!r&&l[0]===0&&(l.push(s),c.push(c[0])),o.push(new Ji(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/i))}return new this(e,-1,o)}static findByName(e,t){let i=e;if(!Array.isArray(e)){let r=e;i=r.geometry&&r.geometry.animations||r.animations}for(let r=0;r<i.length;r++)if(i[r].name===t)return i[r];return null}static CreateClipsFromMorphTargetSequences(e,t,i){let r={},s=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){let c=e[a],u=c.name.match(s);if(u&&u.length>1){let h=u[1],d=r[h];d||(r[h]=d=[]),d.push(c)}}let o=[];for(let a in r)o.push(this.CreateFromMorphTargetSequence(a,r[a],t,i));return o}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;let i=function(h,d,p,v,_){if(p.length!==0){let m=[],f=[];Ox(p,m,f,v),m.length!==0&&_.push(new h(d,m,f))}},r=[],s=e.name||"default",o=e.fps||30,a=e.blendMode,l=e.length||-1,c=e.hierarchy||[];for(let h=0;h<c.length;h++){let d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){let p={},v;for(v=0;v<d.length;v++)if(d[v].morphTargets)for(let _=0;_<d[v].morphTargets.length;_++)p[d[v].morphTargets[_]]=-1;for(let _ in p){let m=[],f=[];for(let g=0;g!==d[v].morphTargets.length;++g){let y=d[v];m.push(y.time),f.push(y.morphTarget===_?1:0)}r.push(new Ji(".morphTargetInfluence["+_+"]",m,f))}l=p.length*o}else{let p=".bones["+t[h].name+"]";i(Qi,p+".position",d,"pos",r),i(Ai,p+".quaternion",d,"rot",r),i(Qi,p+".scale",d,"scl",r)}}return r.length===0?null:new this(s,l,r,a)}resetDuration(){let e=this.tracks,t=0;for(let i=0,r=e.length;i!==r;++i){let s=this.tracks[i];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}};function WR(n){switch(n.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Ji;case"vector":case"vector2":case"vector3":case"vector4":return Qi;case"color":return Vu;case"quaternion":return Ai;case"bool":case"boolean":return Fr;case"string":return kr}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+n)}function XR(n){if(n.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=WR(n.type);if(n.times===void 0){let t=[],i=[];Ox(n.keys,t,i,"value"),n.times=t,n.values=i}return e.parse!==void 0?e.parse(n):new e(n.name,n.times,n.values,n.interpolation)}var Ir={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}},Gp=class{constructor(e,t,i){let r=this,s=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this.itemStart=function(u){a++,s===!1&&r.onStart!==void 0&&r.onStart(u,o,a),s=!0},this.itemEnd=function(u){o++,r.onProgress!==void 0&&r.onProgress(u,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(u){r.onError!==void 0&&r.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,h){return c.push(u,h),this},this.removeHandler=function(u){let h=c.indexOf(u);return h!==-1&&c.splice(h,2),this},this.getHandler=function(u){for(let h=0,d=c.length;h<d;h+=2){let p=c[h],v=c[h+1];if(p.global&&(p.lastIndex=0),p.test(u))return v}return null}}},qR=new Gp,er=class{constructor(e){this.manager=e!==void 0?e:qR,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}};er.DEFAULT_MATERIAL_NAME="__DEFAULT";var Wi={},Wp=class extends Error{constructor(e,t){super(e),this.response=t}},cl=class extends er{constructor(e){super(e)}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=Ir.get(e);if(s!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0),s;if(Wi[e]!==void 0){Wi[e].push({onLoad:t,onProgress:i,onError:r});return}Wi[e]=[],Wi[e].push({onLoad:t,onProgress:i,onError:r});let o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),a=this.mimeType,l=this.responseType;fetch(o).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let u=Wi[e],h=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),p=d?parseInt(d):0,v=p!==0,_=0,m=new ReadableStream({start(f){g();function g(){h.read().then(({done:y,value:x})=>{if(y)f.close();else{_+=x.byteLength;let R=new ProgressEvent("progress",{lengthComputable:v,loaded:_,total:p});for(let T=0,b=u.length;T<b;T++){let C=u[T];C.onProgress&&C.onProgress(R)}f.enqueue(x),g()}})}}});return new Response(m)}else throw new Wp(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(u=>new DOMParser().parseFromString(u,a));case"json":return c.json();default:if(a===void 0)return c.text();{let h=/charset="?([^;"\s]*)"?/i.exec(a),d=h&&h[1]?h[1].toLowerCase():void 0,p=new TextDecoder(d);return c.arrayBuffer().then(v=>p.decode(v))}}}).then(c=>{Ir.add(e,c);let u=Wi[e];delete Wi[e];for(let h=0,d=u.length;h<d;h++){let p=u[h];p.onLoad&&p.onLoad(c)}}).catch(c=>{let u=Wi[e];if(u===void 0)throw this.manager.itemError(e),c;delete Wi[e];for(let h=0,d=u.length;h<d;h++){let p=u[h];p.onError&&p.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}};var Xp=class extends er{constructor(e){super(e)}load(e,t,i,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=Ir.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;let a=el("img");function l(){u(),Ir.add(e,this),t&&t(this),s.manager.itemEnd(e)}function c(h){u(),r&&r(h),s.manager.itemError(e),s.manager.itemEnd(e)}function u(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(e),a.src=e,a}};var Hu=class extends er{constructor(e){super(e)}load(e,t,i,r){let s=new Dt,o=new Xp(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){s.image=a,s.needsUpdate=!0,t!==void 0&&t(s)},i,r),s}},zo=class extends Tt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new we(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}},Gu=class extends zo{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Tt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new we(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}},mp=new Ue,ax=new P,lx=new P,ul=class{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Le(512,512),this.map=null,this.mapPass=null,this.matrix=new Ue,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new il,this._frameExtents=new Le(1,1),this._viewportCount=1,this._viewports=[new ct(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,i=this.matrix;ax.setFromMatrixPosition(e.matrixWorld),t.position.copy(ax),lx.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(lx),t.updateMatrixWorld(),mp.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(mp),i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(mp)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},qp=class extends ul{constructor(){super(new Ft(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(e){let t=this.camera,i=Po*2*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height,s=e.distance||t.far;(i!==t.fov||r!==t.aspect||s!==t.far)&&(t.fov=i,t.aspect=r,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}},Wu=class extends zo{constructor(e,t,i=0,r=Math.PI/3,s=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Tt.DEFAULT_UP),this.updateMatrix(),this.target=new Tt,this.distance=i,this.angle=r,this.penumbra=s,this.decay=o,this.map=null,this.shadow=new qp}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}},cx=new Ue,qa=new P,gp=new P,Yp=class extends ul{constructor(){super(new Ft(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new Le(4,2),this._viewportCount=6,this._viewports=[new ct(2,1,1,1),new ct(0,1,1,1),new ct(3,1,1,1),new ct(1,1,1,1),new ct(3,0,1,1),new ct(1,0,1,1)],this._cubeDirections=[new P(1,0,0),new P(-1,0,0),new P(0,0,1),new P(0,0,-1),new P(0,1,0),new P(0,-1,0)],this._cubeUps=[new P(0,1,0),new P(0,1,0),new P(0,1,0),new P(0,1,0),new P(0,0,1),new P(0,0,-1)]}updateMatrices(e,t=0){let i=this.camera,r=this.matrix,s=e.distance||i.far;s!==i.far&&(i.far=s,i.updateProjectionMatrix()),qa.setFromMatrixPosition(e.matrixWorld),i.position.copy(qa),gp.copy(i.position),gp.add(this._cubeDirections[t]),i.up.copy(this._cubeUps[t]),i.lookAt(gp),i.updateMatrixWorld(),r.makeTranslation(-qa.x,-qa.y,-qa.z),cx.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(cx)}},Xu=class extends zo{constructor(e,t,i=0,r=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=r,this.shadow=new Yp}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}},jp=class extends ul{constructor(){super(new No(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Bo=class extends zo{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Tt.DEFAULT_UP),this.updateMatrix(),this.target=new Tt,this.shadow=new jp}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}};var zr=class{static decodeText(e){if(typeof TextDecoder<"u")return new TextDecoder().decode(e);let t="";for(let i=0,r=e.length;i<r;i++)t+=String.fromCharCode(e[i]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}};var qu=class extends er{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(e){return this.options=e,this}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=Ir.get(e);if(o!==void 0){if(s.manager.itemStart(e),o.then){o.then(c=>{t&&t(c),s.manager.itemEnd(e)}).catch(c=>{r&&r(c)});return}return setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o}let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader;let l=fetch(e,a).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(c){return Ir.add(e,c),t&&t(c),s.manager.itemEnd(e),c}).catch(function(c){r&&r(c),Ir.remove(e),s.manager.itemError(e),s.manager.itemEnd(e)});Ir.add(e,l),s.manager.itemStart(e)}};var Kp=class{constructor(e,t,i){this.binding=e,this.valueSize=i;let r,s,o;switch(t){case"quaternion":r=this._slerp,s=this._slerpAdditive,o=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(i*6),this._workIndex=5;break;case"string":case"bool":r=this._select,s=this._select,o=this._setAdditiveIdentityOther,this.buffer=new Array(i*5);break;default:r=this._lerp,s=this._lerpAdditive,o=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(i*5)}this._mixBufferRegion=r,this._mixBufferRegionAdditive=s,this._setIdentity=o,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){let i=this.buffer,r=this.valueSize,s=e*r+r,o=this.cumulativeWeight;if(o===0){for(let a=0;a!==r;++a)i[s+a]=i[a];o=t}else{o+=t;let a=t/o;this._mixBufferRegion(i,s,0,a,r)}this.cumulativeWeight=o}accumulateAdditive(e){let t=this.buffer,i=this.valueSize,r=i*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,r,0,e,i),this.cumulativeWeightAdditive+=e}apply(e){let t=this.valueSize,i=this.buffer,r=e*t+t,s=this.cumulativeWeight,o=this.cumulativeWeightAdditive,a=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){let l=t*this._origIndex;this._mixBufferRegion(i,r,l,1-s,t)}o>0&&this._mixBufferRegionAdditive(i,r,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(i[l]!==i[l+t]){a.setValue(i,r);break}}saveOriginalState(){let e=this.binding,t=this.buffer,i=this.valueSize,r=i*this._origIndex;e.getValue(t,r);for(let s=i,o=r;s!==o;++s)t[s]=t[r+s%i];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){let e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){let e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let i=e;i<t;i++)this.buffer[i]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){let e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let i=0;i<this.valueSize;i++)this.buffer[t+i]=this.buffer[e+i]}_select(e,t,i,r,s){if(r>=.5)for(let o=0;o!==s;++o)e[t+o]=e[i+o]}_slerp(e,t,i,r){bn.slerpFlat(e,t,e,t,e,i,r)}_slerpAdditive(e,t,i,r,s){let o=this._workIndex*s;bn.multiplyQuaternionsFlat(e,o,e,t,e,i),bn.slerpFlat(e,t,e,t,e,o,r)}_lerp(e,t,i,r,s){let o=1-r;for(let a=0;a!==s;++a){let l=t+a;e[l]=e[l]*o+e[i+a]*r}}_lerpAdditive(e,t,i,r,s){for(let o=0;o!==s;++o){let a=t+o;e[a]=e[a]+e[i+o]*r}}},sm="\\[\\]\\.:\\/",YR=new RegExp("["+sm+"]","g"),om="[^"+sm+"]",jR="[^"+sm.replace("\\.","")+"]",KR=/((?:WC+[\/:])*)/.source.replace("WC",om),ZR=/(WCOD+)?/.source.replace("WCOD",jR),$R=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",om),JR=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",om),QR=new RegExp("^"+KR+ZR+$R+JR+"$"),eC=["material","materials","bones","map"],Zp=class{constructor(e,t,i){let r=i||lt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},lt=class n{constructor(e,t,i){this.path=t,this.parsedPath=i||n.parseTrackName(t),this.node=n.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new n.Composite(e,t,i):new n(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(YR,"")}static parseTrackName(e){let t=QR.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);eC.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let l=i(a.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=n.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[r];if(o===void 0){let c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?a=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};lt.Composite=Zp;lt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};lt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};lt.prototype.GetterByBindingType=[lt.prototype._getValue_direct,lt.prototype._getValue_array,lt.prototype._getValue_arrayElement,lt.prototype._getValue_toArray];lt.prototype.SetterByBindingTypeAndVersioning=[[lt.prototype._setValue_direct,lt.prototype._setValue_direct_setNeedsUpdate,lt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[lt.prototype._setValue_array,lt.prototype._setValue_array_setNeedsUpdate,lt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[lt.prototype._setValue_arrayElement,lt.prototype._setValue_arrayElement_setNeedsUpdate,lt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[lt.prototype._setValue_fromArray,lt.prototype._setValue_fromArray_setNeedsUpdate,lt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var $p=class{constructor(e,t,i=null,r=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=i,this.blendMode=r;let s=t.tracks,o=s.length,a=new Array(o),l={endingStart:yo,endingEnd:yo};for(let c=0;c!==o;++c){let u=s[c].createInterpolant(null);a[c]=u,u.settings=l}this._interpolantSettings=l,this._interpolants=a,this._propertyBindings=new Array(o),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=yw,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,i){if(e.fadeOut(t),this.fadeIn(t),i){let r=this._clip.duration,s=e._clip.duration,o=s/r,a=r/s;e.warp(1,o,t),this.warp(a,1,t)}return this}crossFadeTo(e,t,i){return e.crossFadeFrom(this,t,i)}stopFading(){let e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,i){let r=this._mixer,s=r.time,o=this.timeScale,a=this._timeScaleInterpolant;a===null&&(a=r._lendControlInterpolant(),this._timeScaleInterpolant=a);let l=a.parameterPositions,c=a.sampleValues;return l[0]=s,l[1]=s+i,c[0]=e/o,c[1]=t/o,this}stopWarping(){let e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,i,r){if(!this.enabled){this._updateWeight(e);return}let s=this._startTime;if(s!==null){let l=(e-s)*i;l<0||i===0?t=0:(this._startTime=null,t=i*l)}t*=this._updateTimeScale(e);let o=this._updateTime(t),a=this._updateWeight(e);if(a>0){let l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case xw:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulateAdditive(a);break;case tm:default:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulate(r,a)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;let i=this._weightInterpolant;if(i!==null){let r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopFading(),r===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;let i=this._timeScaleInterpolant;if(i!==null){let r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){let t=this._clip.duration,i=this.loop,r=this.time+e,s=this._loopCount,o=i===_w;if(e===0)return s===-1?r:o&&(s&1)===1?t-r:r;if(i===vw){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(r>=t)r=t;else if(r<0)r=0;else{this.time=r;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(s===-1&&(e>=0?(s=0,this._setEndings(!0,this.repetitions===0,o)):this._setEndings(this.repetitions===0,!0,o)),r>=t||r<0){let a=Math.floor(r/t);r-=t*a,s+=Math.abs(a);let l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,r=e>0?t:0,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){let c=e<0;this._setEndings(c,!c,o)}else this._setEndings(!1,!1,o);this._loopCount=s,this.time=r,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:a})}}else this.time=r;if(o&&(s&1)===1)return t-r}return r}_setEndings(e,t,i){let r=this._interpolantSettings;i?(r.endingStart=_o,r.endingEnd=_o):(e?r.endingStart=this.zeroSlopeAtStart?_o:yo:r.endingStart=gu,t?r.endingEnd=this.zeroSlopeAtEnd?_o:yo:r.endingEnd=gu)}_scheduleFading(e,t,i){let r=this._mixer,s=r.time,o=this._weightInterpolant;o===null&&(o=r._lendControlInterpolant(),this._weightInterpolant=o);let a=o.parameterPositions,l=o.sampleValues;return a[0]=s,l[0]=t,a[1]=s+e,l[1]=i,this}},tC=new Float32Array(1),Yu=class extends Ki{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){let i=e._localRoot||this._root,r=e._clip.tracks,s=r.length,o=e._propertyBindings,a=e._interpolants,l=i.uuid,c=this._bindingsByRootAndName,u=c[l];u===void 0&&(u={},c[l]=u);for(let h=0;h!==s;++h){let d=r[h],p=d.name,v=u[p];if(v!==void 0)++v.referenceCount,o[h]=v;else{if(v=o[h],v!==void 0){v._cacheIndex===null&&(++v.referenceCount,this._addInactiveBinding(v,l,p));continue}let _=t&&t._propertyBindings[h].binding.parsedPath;v=new Kp(lt.create(i,p,_),d.ValueTypeName,d.getValueSize()),++v.referenceCount,this._addInactiveBinding(v,l,p),o[h]=v}a[h].resultBuffer=v.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){let i=(e._localRoot||this._root).uuid,r=e._clip.uuid,s=this._actionsByClip[r];this._bindAction(e,s&&s.knownActions[0]),this._addInactiveAction(e,r,i)}let t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){let s=t[i];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){let t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){let s=t[i];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;let e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){let t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,i){let r=this._actions,s=this._actionsByClip,o=s[t];if(o===void 0)o={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,s[t]=o;else{let a=o.knownActions;e._byClipCacheIndex=a.length,a.push(e)}e._cacheIndex=r.length,r.push(e),o.actionByRoot[i]=e}_removeInactiveAction(e){let t=this._actions,i=t[t.length-1],r=e._cacheIndex;i._cacheIndex=r,t[r]=i,t.pop(),e._cacheIndex=null;let s=e._clip.uuid,o=this._actionsByClip,a=o[s],l=a.knownActions,c=l[l.length-1],u=e._byClipCacheIndex;c._byClipCacheIndex=u,l[u]=c,l.pop(),e._byClipCacheIndex=null;let h=a.actionByRoot,d=(e._localRoot||this._root).uuid;delete h[d],l.length===0&&delete o[s],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){let t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){let s=t[i];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(e){let t=this._actions,i=e._cacheIndex,r=this._nActiveActions++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackAction(e){let t=this._actions,i=e._cacheIndex,r=--this._nActiveActions,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_addInactiveBinding(e,t,i){let r=this._bindingsByRootAndName,s=this._bindings,o=r[t];o===void 0&&(o={},r[t]=o),o[i]=e,e._cacheIndex=s.length,s.push(e)}_removeInactiveBinding(e){let t=this._bindings,i=e.binding,r=i.rootNode.uuid,s=i.path,o=this._bindingsByRootAndName,a=o[r],l=t[t.length-1],c=e._cacheIndex;l._cacheIndex=c,t[c]=l,t.pop(),delete a[s],Object.keys(a).length===0&&delete o[r]}_lendBinding(e){let t=this._bindings,i=e._cacheIndex,r=this._nActiveBindings++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackBinding(e){let t=this._bindings,i=e._cacheIndex,r=--this._nActiveBindings,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_lendControlInterpolant(){let e=this._controlInterpolants,t=this._nActiveControlInterpolants++,i=e[t];return i===void 0&&(i=new Bu(new Float32Array(2),new Float32Array(2),1,tC),i.__cacheIndex=t,e[t]=i),i}_takeBackControlInterpolant(e){let t=this._controlInterpolants,i=e.__cacheIndex,r=--this._nActiveControlInterpolants,s=t[r];e.__cacheIndex=r,t[r]=e,s.__cacheIndex=i,t[i]=s}clipAction(e,t,i){let r=t||this._root,s=r.uuid,o=typeof e=="string"?ko.findByName(r,e):e,a=o!==null?o.uuid:e,l=this._actionsByClip[a],c=null;if(i===void 0&&(o!==null?i=o.blendMode:i=tm),l!==void 0){let h=l.actionByRoot[s];if(h!==void 0&&h.blendMode===i)return h;c=l.knownActions[0],o===null&&(o=c._clip)}if(o===null)return null;let u=new $p(this,o,t,i);return this._bindAction(u,c),this._addInactiveAction(u,a,s),u}existingAction(e,t){let i=t||this._root,r=i.uuid,s=typeof e=="string"?ko.findByName(i,e):e,o=s?s.uuid:e,a=this._actionsByClip[o];return a!==void 0&&a.actionByRoot[r]||null}stopAllAction(){let e=this._actions,t=this._nActiveActions;for(let i=t-1;i>=0;--i)e[i].stop();return this}update(e){e*=this.timeScale;let t=this._actions,i=this._nActiveActions,r=this.time+=e,s=Math.sign(e),o=this._accuIndex^=1;for(let c=0;c!==i;++c)t[c]._update(r,e,s,o);let a=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)a[c].apply(o);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){let t=this._actions,i=e.uuid,r=this._actionsByClip,s=r[i];if(s!==void 0){let o=s.knownActions;for(let a=0,l=o.length;a!==l;++a){let c=o[a];this._deactivateAction(c);let u=c._cacheIndex,h=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,h._cacheIndex=u,t[u]=h,t.pop(),this._removeInactiveBindingsForAction(c)}delete r[i]}}uncacheRoot(e){let t=e.uuid,i=this._actionsByClip;for(let o in i){let a=i[o].actionByRoot,l=a[t];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}let r=this._bindingsByRootAndName,s=r[t];if(s!==void 0)for(let o in s){let a=s[o];a.restoreOriginalState(),this._removeInactiveBinding(a)}}uncacheAction(e,t){let i=this.existingAction(e,t);i!==null&&(this._deactivateAction(i),this._removeInactiveAction(i))}};var ux=new Ue,ju=class{constructor(e,t,i=0,r=1/0){this.ray=new $i(e,t),this.near=i,this.far=r,this.camera=null,this.layers=new tl,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return ux.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(ux),this}intersectObject(e,t=!0,i=[]){return Jp(e,this,i,t),i.sort(hx),i}intersectObjects(e,t=!0,i=[]){for(let r=0,s=e.length;r<s;r++)Jp(e[r],this,i,t);return i.sort(hx),i}};function hx(n,e){return n.distance-e.distance}function Jp(n,e,t,i){if(n.layers.test(e.layers)&&n.raycast(e,t),i===!0){let r=n.children;for(let s=0,o=r.length;s<o;s++)Jp(r[s],e,t,!0)}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"164"}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="164");function am(n,e){if(e===wx)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),n;if(e===fl||e===$u){let t=n.getIndex();if(t===null){let o=[],a=n.getAttribute("position");if(a!==void 0){for(let l=0;l<a.count;l++)o.push(l);n.setIndex(o),t=n.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),n}let i=t.count-2,r=[];if(e===fl)for(let o=1;o<=i;o++)r.push(t.getX(0)),r.push(t.getX(o)),r.push(t.getX(o+1));else for(let o=0;o<i;o++)o%2===0?(r.push(t.getX(o)),r.push(t.getX(o+1)),r.push(t.getX(o+2))):(r.push(t.getX(o+2)),r.push(t.getX(o+1)),r.push(t.getX(o)));r.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");let s=n.clone();return s.setIndex(r),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),n}var th=class extends er{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new pm(t)}),this.register(function(t){return new mm(t)}),this.register(function(t){return new Em(t)}),this.register(function(t){return new Tm(t)}),this.register(function(t){return new Am(t)}),this.register(function(t){return new vm(t)}),this.register(function(t){return new ym(t)}),this.register(function(t){return new _m(t)}),this.register(function(t){return new xm(t)}),this.register(function(t){return new fm(t)}),this.register(function(t){return new Mm(t)}),this.register(function(t){return new gm(t)}),this.register(function(t){return new wm(t)}),this.register(function(t){return new Sm(t)}),this.register(function(t){return new hm(t)}),this.register(function(t){return new bm(t)}),this.register(function(t){return new Rm(t)})}load(e,t,i,r){let s=this,o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){let c=zr.extractUrlBase(e);o=zr.resolveURL(c,this.path)}else o=zr.extractUrlBase(e);this.manager.itemStart(e);let a=function(c){r?r(c):console.error(c),s.manager.itemError(e),s.manager.itemEnd(e)},l=new cl(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{s.parse(c,o,function(u){t(u),s.manager.itemEnd(e)},a)}catch(u){a(u)}},i,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setDDSLoader(){throw new Error('THREE.GLTFLoader: "MSFT_texture_dds" no longer supported. Please update to "KHR_texture_basisu".')}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,i,r){let s,o={},a={},l=new TextDecoder;if(typeof e=="string")s=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Vx){try{o[je.KHR_BINARY_GLTF]=new Cm(e)}catch(h){r&&r(h);return}s=JSON.parse(o[je.KHR_BINARY_GLTF].content)}else s=JSON.parse(l.decode(e));else s=e;if(s.asset===void 0||s.asset.version[0]<2){r&&r(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let c=new Om(s,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let u=0;u<this.pluginCallbacks.length;u++){let h=this.pluginCallbacks[u](c);h.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[h.name]=h,o[h.name]=!0}if(s.extensionsUsed)for(let u=0;u<s.extensionsUsed.length;++u){let h=s.extensionsUsed[u],d=s.extensionsRequired||[];switch(h){case je.KHR_MATERIALS_UNLIT:o[h]=new dm;break;case je.KHR_DRACO_MESH_COMPRESSION:o[h]=new Pm(s,this.dracoLoader);break;case je.KHR_TEXTURE_TRANSFORM:o[h]=new Im;break;case je.KHR_MESH_QUANTIZATION:o[h]=new Lm;break;default:d.indexOf(h)>=0&&a[h]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+h+'".')}}c.setExtensions(o),c.setPlugins(a),c.parse(i,r)}parseAsync(e,t){let i=this;return new Promise(function(r,s){i.parse(e,t,r,s)})}};function nC(){let n={};return{get:function(e){return n[e]},add:function(e,t){n[e]=t},remove:function(e){delete n[e]},removeAll:function(){n={}}}}var je={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},hm=class{constructor(e){this.parser=e,this.name=je.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let i=0,r=t.length;i<r;i++){let s=t[i];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(e){let t=this.parser,i="light:"+e,r=t.cache.get(i);if(r)return r;let s=t.json,l=((s.extensions&&s.extensions[this.name]||{}).lights||[])[e],c,u=new we(16777215);l.color!==void 0&&u.setRGB(l.color[0],l.color[1],l.color[2],jt);let h=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new Bo(u),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new Xu(u),c.distance=h;break;case"spot":c=new Wu(u),c.distance=h,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),c.decay=2,Vr(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),r=Promise.resolve(c),t.cache.add(i,r),r}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,i=this.parser,s=i.json.nodes[e],a=(s.extensions&&s.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(l){return i._getNodeRef(t.cache,a,l)})}},dm=class{constructor(){this.name=je.KHR_MATERIALS_UNLIT}getMaterialType(){return qt}extendParams(e,t,i){let r=[];e.color=new we(1,1,1),e.opacity=1;let s=t.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){let o=s.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],jt),e.opacity=o[3]}s.baseColorTexture!==void 0&&r.push(i.assignTexture(e,"map",s.baseColorTexture,wt))}return Promise.all(r)}},fm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=r.extensions[this.name].emissiveStrength;return s!==void 0&&(t.emissiveIntensity=s),Promise.resolve()}},pm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[],o=r.extensions[this.name];if(o.clearcoatFactor!==void 0&&(t.clearcoat=o.clearcoatFactor),o.clearcoatTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatMap",o.clearcoatTexture)),o.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=o.clearcoatRoughnessFactor),o.clearcoatRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatRoughnessMap",o.clearcoatRoughnessTexture)),o.clearcoatNormalTexture!==void 0&&(s.push(i.assignTexture(t,"clearcoatNormalMap",o.clearcoatNormalTexture)),o.clearcoatNormalTexture.scale!==void 0)){let a=o.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new Le(a,a)}return Promise.all(s)}},mm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_DISPERSION}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=r.extensions[this.name];return t.dispersion=s.dispersion!==void 0?s.dispersion:0,Promise.resolve()}},gm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[],o=r.extensions[this.name];return o.iridescenceFactor!==void 0&&(t.iridescence=o.iridescenceFactor),o.iridescenceTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceMap",o.iridescenceTexture)),o.iridescenceIor!==void 0&&(t.iridescenceIOR=o.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),o.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=o.iridescenceThicknessMaximum),o.iridescenceThicknessTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceThicknessMap",o.iridescenceThicknessTexture)),Promise.all(s)}},vm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_SHEEN}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[];t.sheenColor=new we(0,0,0),t.sheenRoughness=0,t.sheen=1;let o=r.extensions[this.name];if(o.sheenColorFactor!==void 0){let a=o.sheenColorFactor;t.sheenColor.setRGB(a[0],a[1],a[2],jt)}return o.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=o.sheenRoughnessFactor),o.sheenColorTexture!==void 0&&s.push(i.assignTexture(t,"sheenColorMap",o.sheenColorTexture,wt)),o.sheenRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"sheenRoughnessMap",o.sheenRoughnessTexture)),Promise.all(s)}},ym=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[],o=r.extensions[this.name];return o.transmissionFactor!==void 0&&(t.transmission=o.transmissionFactor),o.transmissionTexture!==void 0&&s.push(i.assignTexture(t,"transmissionMap",o.transmissionTexture)),Promise.all(s)}},_m=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_VOLUME}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[],o=r.extensions[this.name];t.thickness=o.thicknessFactor!==void 0?o.thicknessFactor:0,o.thicknessTexture!==void 0&&s.push(i.assignTexture(t,"thicknessMap",o.thicknessTexture)),t.attenuationDistance=o.attenuationDistance||1/0;let a=o.attenuationColor||[1,1,1];return t.attenuationColor=new we().setRGB(a[0],a[1],a[2],jt),Promise.all(s)}},xm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_IOR}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=r.extensions[this.name];return t.ior=s.ior!==void 0?s.ior:1.5,Promise.resolve()}},Mm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_SPECULAR}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[],o=r.extensions[this.name];t.specularIntensity=o.specularFactor!==void 0?o.specularFactor:1,o.specularTexture!==void 0&&s.push(i.assignTexture(t,"specularIntensityMap",o.specularTexture));let a=o.specularColorFactor||[1,1,1];return t.specularColor=new we().setRGB(a[0],a[1],a[2],jt),o.specularColorTexture!==void 0&&s.push(i.assignTexture(t,"specularColorMap",o.specularColorTexture,wt)),Promise.all(s)}},Sm=class{constructor(e){this.parser=e,this.name=je.EXT_MATERIALS_BUMP}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[],o=r.extensions[this.name];return t.bumpScale=o.bumpFactor!==void 0?o.bumpFactor:1,o.bumpTexture!==void 0&&s.push(i.assignTexture(t,"bumpMap",o.bumpTexture)),Promise.all(s)}},wm=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){let i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Bn}extendMaterialParams(e,t){let i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();let s=[],o=r.extensions[this.name];return o.anisotropyStrength!==void 0&&(t.anisotropy=o.anisotropyStrength),o.anisotropyRotation!==void 0&&(t.anisotropyRotation=o.anisotropyRotation),o.anisotropyTexture!==void 0&&s.push(i.assignTexture(t,"anisotropyMap",o.anisotropyTexture)),Promise.all(s)}},Em=class{constructor(e){this.parser=e,this.name=je.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,i=t.json,r=i.textures[e];if(!r.extensions||!r.extensions[this.name])return null;let s=r.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,s.source,o)}},Tm=class{constructor(e){this.parser=e,this.name=je.EXT_TEXTURE_WEBP,this.isSupported=null}loadTexture(e){let t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;let o=s.extensions[t],a=r.images[o.source],l=i.textureLoader;if(a.uri){let c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return this.detectSupport().then(function(c){if(c)return i.loadTextureImage(e,o.source,l);if(r.extensionsRequired&&r.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");return i.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){let t=new Image;t.src="data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}},Am=class{constructor(e){this.parser=e,this.name=je.EXT_TEXTURE_AVIF,this.isSupported=null}loadTexture(e){let t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;let o=s.extensions[t],a=r.images[o.source],l=i.textureLoader;if(a.uri){let c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return this.detectSupport().then(function(c){if(c)return i.loadTextureImage(e,o.source,l);if(r.extensionsRequired&&r.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");return i.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){let t=new Image;t.src="data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}},bm=class{constructor(e){this.name=je.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){let t=this.parser.json,i=t.bufferViews[e];if(i.extensions&&i.extensions[this.name]){let r=i.extensions[this.name],s=this.parser.getDependency("buffer",r.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(a){let l=r.byteOffset||0,c=r.byteLength||0,u=r.count,h=r.byteStride,d=new Uint8Array(a,l,c);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(u,h,d,r.mode,r.filter).then(function(p){return p.buffer}):o.ready.then(function(){let p=new ArrayBuffer(u*h);return o.decodeGltfBuffer(new Uint8Array(p),u,h,d,r.mode,r.filter),p})})}else return null}},Rm=class{constructor(e){this.name=je.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,i=t.nodes[e];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;let r=t.meshes[i.mesh];for(let c of r.primitives)if(c.mode!==Jn.TRIANGLES&&c.mode!==Jn.TRIANGLE_STRIP&&c.mode!==Jn.TRIANGLE_FAN&&c.mode!==void 0)return null;let o=i.extensions[this.name].attributes,a=[],l={};for(let c in o)a.push(this.parser.getDependency("accessor",o[c]).then(u=>(l[c]=u,l[c])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(c=>{let u=c.pop(),h=u.isGroup?u.children:[u],d=c[0].count,p=[];for(let v of h){let _=new Ue,m=new P,f=new bn,g=new P(1,1,1),y=new Nu(v.geometry,v.material,d);for(let x=0;x<d;x++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,x),l.ROTATION&&f.fromBufferAttribute(l.ROTATION,x),l.SCALE&&g.fromBufferAttribute(l.SCALE,x),y.setMatrixAt(x,_.compose(m,f,g));for(let x in l)if(x==="_COLOR_0"){let R=l[x];y.instanceColor=new gs(R.array,R.itemSize,R.normalized)}else x!=="TRANSLATION"&&x!=="ROTATION"&&x!=="SCALE"&&v.geometry.setAttribute(x,l[x]);Tt.prototype.copy.call(y,v),this.parser.assignFinalMaterial(y),p.push(y)}return u.isGroup?(u.clear(),u.add(...p),u):p[0]}))}},Vx="glTF",ml=12,Fx={JSON:1313821514,BIN:5130562},Cm=class{constructor(e){this.name=je.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,ml),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Vx)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let r=this.header.length-ml,s=new DataView(e,ml),o=0;for(;o<r;){let a=s.getUint32(o,!0);o+=4;let l=s.getUint32(o,!0);if(o+=4,l===Fx.JSON){let c=new Uint8Array(e,ml+o,a);this.content=i.decode(c)}else if(l===Fx.BIN){let c=ml+o;this.body=e.slice(c,c+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},Pm=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=je.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let i=this.json,r=this.dracoLoader,s=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},l={},c={};for(let u in o){let h=Dm[u]||u.toLowerCase();a[h]=o[u]}for(let u in e.attributes){let h=Dm[u]||u.toLowerCase();if(o[u]!==void 0){let d=i.accessors[e.attributes[u]],p=Ho[d.componentType];c[h]=p.name,l[h]=d.normalized===!0}}return t.getDependency("bufferView",s).then(function(u){return new Promise(function(h,d){r.decodeDracoFile(u,function(p){for(let v in p.attributes){let _=p.attributes[v],m=l[v];m!==void 0&&(_.normalized=m)}h(p)},a,c,jt,d)})})}},Im=class{constructor(){this.name=je.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}},Lm=class{constructor(){this.name=je.KHR_MESH_QUANTIZATION}},nh=class extends Or{constructor(e,t,i,r){super(e,t,i,r)}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r*3+r;for(let o=0;o!==r;o++)t[o]=i[s+o];return t}interpolate_(e,t,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=a*2,c=a*3,u=r-t,h=(i-t)/u,d=h*h,p=d*h,v=e*c,_=v-c,m=-2*p+3*d,f=p-d,g=1-m,y=f-d+h;for(let x=0;x!==a;x++){let R=o[_+x+a],T=o[_+x+l]*u,b=o[v+x+a],C=o[v+x]*u;s[x]=g*R+y*T+m*b+f*C}return s}},iC=new bn,Nm=class extends nh{interpolate_(e,t,i,r){let s=super.interpolate_(e,t,i,r);return iC.fromArray(s).normalize().toArray(s),s}},Jn={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Ho={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},kx={9728:cn,9729:An,9984:em,9985:ja,9986:vo,9987:Mi},zx={33071:Yi,33648:Ja,10497:ps},lm={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Dm={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Br={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},rC={CUBICSPLINE:void 0,LINEAR:ms,STEP:Co},cm={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function sC(n){return n.DefaultMaterial===void 0&&(n.DefaultMaterial=new Ti({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Zn})),n.DefaultMaterial}function vs(n,e,t){for(let i in t.extensions)n[i]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[i]=t.extensions[i])}function Vr(n,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(n.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function oC(n,e,t){let i=!1,r=!1,s=!1;for(let c=0,u=e.length;c<u;c++){let h=e[c];if(h.POSITION!==void 0&&(i=!0),h.NORMAL!==void 0&&(r=!0),h.COLOR_0!==void 0&&(s=!0),i&&r&&s)break}if(!i&&!r&&!s)return Promise.resolve(n);let o=[],a=[],l=[];for(let c=0,u=e.length;c<u;c++){let h=e[c];if(i){let d=h.POSITION!==void 0?t.getDependency("accessor",h.POSITION):n.attributes.position;o.push(d)}if(r){let d=h.NORMAL!==void 0?t.getDependency("accessor",h.NORMAL):n.attributes.normal;a.push(d)}if(s){let d=h.COLOR_0!==void 0?t.getDependency("accessor",h.COLOR_0):n.attributes.color;l.push(d)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l)]).then(function(c){let u=c[0],h=c[1],d=c[2];return i&&(n.morphAttributes.position=u),r&&(n.morphAttributes.normal=h),s&&(n.morphAttributes.color=d),n.morphTargetsRelative=!0,n})}function aC(n,e){if(n.updateMorphTargets(),e.weights!==void 0)for(let t=0,i=e.weights.length;t<i;t++)n.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(n.morphTargetInfluences.length===t.length){n.morphTargetDictionary={};for(let i=0,r=t.length;i<r;i++)n.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function lC(n){let e,t=n.extensions&&n.extensions[je.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+um(t.attributes):e=n.indices+":"+um(n.attributes)+":"+n.mode,n.targets!==void 0)for(let i=0,r=n.targets.length;i<r;i++)e+=":"+um(n.targets[i]);return e}function um(n){let e="",t=Object.keys(n).sort();for(let i=0,r=t.length;i<r;i++)e+=t[i]+":"+n[t[i]]+";";return e}function Um(n){switch(n){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function cC(n){return n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0?"image/jpeg":n.search(/\.webp($|\?)/i)>0||n.search(/^data\:image\/webp/)===0?"image/webp":"image/png"}var uC=new Ue,Om=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new nC,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,r=!1,s=-1;typeof navigator<"u"&&(i=/^((?!chrome|android).)*safari/i.test(navigator.userAgent)===!0,r=navigator.userAgent.indexOf("Firefox")>-1,s=r?navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1]:-1),typeof createImageBitmap>"u"||i||r&&s<98?this.textureLoader=new Hu(this.options.manager):this.textureLoader=new qu(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new cl(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let i=this,r=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(o){let a={scene:o[0][r.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:r.asset,parser:i,userData:{}};return vs(s,a,r),Vr(a,r),Promise.all(i._invokeAll(function(l){return l.afterRoot&&l.afterRoot(a)})).then(function(){for(let l of a.scenes)l.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let r=0,s=t.length;r<s;r++){let o=t[r].joints;for(let a=0,l=o.length;a<l;a++)e[o[a]].isBone=!0}for(let r=0,s=e.length;r<s;r++){let o=e[r];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(i[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,i){if(e.refs[t]<=1)return i;let r=i.clone(),s=(o,a)=>{let l=this.associations.get(o);l!=null&&this.associations.set(a,l);for(let[c,u]of o.children.entries())s(u,a.children[c])};return s(i,r),r.name+="_instance_"+e.uses[t]++,r}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){let r=e(t[i]);if(r)return r}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let i=[];for(let r=0;r<t.length;r++){let s=e(t[r]);s&&i.push(s)}return i}getDependency(e,t){let i=e+":"+t,r=this.cache.get(i);if(!r){switch(e){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(s){return s.loadNode&&s.loadNode(t)});break;case"mesh":r=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)}),!r)throw new Error("Unknown type: "+e);break}this.cache.add(i,r)}return r}getDependencies(e){let t=this.cache.get(e);if(!t){let i=this,r=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(r.map(function(s,o){return i.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[je.KHR_BINARY_GLTF].body);let r=this.options;return new Promise(function(s,o){i.load(zr.resolveURL(t.uri,r.path),s,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(i){let r=t.byteLength||0,s=t.byteOffset||0;return i.slice(s,s+r)})}loadAccessor(e){let t=this,i=this.json,r=this.json.accessors[e];if(r.bufferView===void 0&&r.sparse===void 0){let o=lm[r.type],a=Ho[r.componentType],l=r.normalized===!0,c=new a(r.count*o);return Promise.resolve(new Ct(c,o,l))}let s=[];return r.bufferView!==void 0?s.push(this.getDependency("bufferView",r.bufferView)):s.push(null),r.sparse!==void 0&&(s.push(this.getDependency("bufferView",r.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",r.sparse.values.bufferView))),Promise.all(s).then(function(o){let a=o[0],l=lm[r.type],c=Ho[r.componentType],u=c.BYTES_PER_ELEMENT,h=u*l,d=r.byteOffset||0,p=r.bufferView!==void 0?i.bufferViews[r.bufferView].byteStride:void 0,v=r.normalized===!0,_,m;if(p&&p!==h){let f=Math.floor(d/p),g="InterleavedBuffer:"+r.bufferView+":"+r.componentType+":"+f+":"+r.count,y=t.cache.get(g);y||(_=new c(a,f*p,r.count*p/u),y=new rl(_,p/u),t.cache.add(g,y)),m=new sl(y,l,d%p/u,v)}else a===null?_=new c(r.count*l):_=new c(a,d,r.count*l),m=new Ct(_,l,v);if(r.sparse!==void 0){let f=lm.SCALAR,g=Ho[r.sparse.indices.componentType],y=r.sparse.indices.byteOffset||0,x=r.sparse.values.byteOffset||0,R=new g(o[1],y,r.sparse.count*f),T=new c(o[2],x,r.sparse.count*l);a!==null&&(m=new Ct(m.array.slice(),m.itemSize,m.normalized));for(let b=0,C=R.length;b<C;b++){let E=R[b];if(m.setX(E,T[b*l]),l>=2&&m.setY(E,T[b*l+1]),l>=3&&m.setZ(E,T[b*l+2]),l>=4&&m.setW(E,T[b*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}}return m})}loadTexture(e){let t=this.json,i=this.options,s=t.textures[e].source,o=t.images[s],a=this.textureLoader;if(o.uri){let l=i.manager.getHandler(o.uri);l!==null&&(a=l)}return this.loadTextureImage(e,s,a)}loadTextureImage(e,t,i){let r=this,s=this.json,o=s.textures[e],a=s.images[t],l=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,i).then(function(u){u.flipY=!1,u.name=o.name||a.name||"",u.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(u.name=a.uri);let d=(s.samplers||{})[o.sampler]||{};return u.magFilter=kx[d.magFilter]||An,u.minFilter=kx[d.minFilter]||Mi,u.wrapS=zx[d.wrapS]||ps,u.wrapT=zx[d.wrapT]||ps,r.associations.set(u,{textures:e}),u}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let i=this,r=this.json,s=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(h=>h.clone());let o=r.images[e],a=self.URL||self.webkitURL,l=o.uri||"",c=!1;if(o.bufferView!==void 0)l=i.getDependency("bufferView",o.bufferView).then(function(h){c=!0;let d=new Blob([h],{type:o.mimeType});return l=a.createObjectURL(d),l});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let u=Promise.resolve(l).then(function(h){return new Promise(function(d,p){let v=d;t.isImageBitmapLoader===!0&&(v=function(_){let m=new Dt(_);m.needsUpdate=!0,d(m)}),t.load(zr.resolveURL(h,s.path),v,void 0,p)})}).then(function(h){return c===!0&&a.revokeObjectURL(l),h.userData.mimeType=o.mimeType||cC(o.uri),h}).catch(function(h){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),h});return this.sourceCache[e]=u,u}assignTexture(e,t,i,r){let s=this;return this.getDependency("texture",i.index).then(function(o){if(!o)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(o=o.clone(),o.channel=i.texCoord),s.extensions[je.KHR_TEXTURE_TRANSFORM]){let a=i.extensions!==void 0?i.extensions[je.KHR_TEXTURE_TRANSFORM]:void 0;if(a){let l=s.associations.get(o);o=s.extensions[je.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),s.associations.set(o,l)}}return r!==void 0&&(o.colorSpace=r),e[t]=o,o})}assignFinalMaterial(e){let t=e.geometry,i=e.material,r=t.attributes.tangent===void 0,s=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){let a="PointsMaterial:"+i.uuid,l=this.cache.get(a);l||(l=new ll,zn.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,l.sizeAttenuation=!1,this.cache.add(a,l)),i=l}else if(e.isLine){let a="LineBasicMaterial:"+i.uuid,l=this.cache.get(a);l||(l=new al,zn.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,this.cache.add(a,l)),i=l}if(r||s||o){let a="ClonedMaterial:"+i.uuid+":";r&&(a+="derivative-tangents:"),s&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let l=this.cache.get(a);l||(l=i.clone(),s&&(l.vertexColors=!0),o&&(l.flatShading=!0),r&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(a,l),this.associations.set(l,this.associations.get(i))),i=l}e.material=i}getMaterialType(){return Ti}loadMaterial(e){let t=this,i=this.json,r=this.extensions,s=i.materials[e],o,a={},l=s.extensions||{},c=[];if(l[je.KHR_MATERIALS_UNLIT]){let h=r[je.KHR_MATERIALS_UNLIT];o=h.getMaterialType(),c.push(h.extendParams(a,s,t))}else{let h=s.pbrMetallicRoughness||{};if(a.color=new we(1,1,1),a.opacity=1,Array.isArray(h.baseColorFactor)){let d=h.baseColorFactor;a.color.setRGB(d[0],d[1],d[2],jt),a.opacity=d[3]}h.baseColorTexture!==void 0&&c.push(t.assignTexture(a,"map",h.baseColorTexture,wt)),a.metalness=h.metallicFactor!==void 0?h.metallicFactor:1,a.roughness=h.roughnessFactor!==void 0?h.roughnessFactor:1,h.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(a,"metalnessMap",h.metallicRoughnessTexture)),c.push(t.assignTexture(a,"roughnessMap",h.metallicRoughnessTexture))),o=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,a)})))}s.doubleSided===!0&&(a.side=yn);let u=s.alphaMode||cm.OPAQUE;if(u===cm.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,u===cm.MASK&&(a.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&o!==qt&&(c.push(t.assignTexture(a,"normalMap",s.normalTexture)),a.normalScale=new Le(1,1),s.normalTexture.scale!==void 0)){let h=s.normalTexture.scale;a.normalScale.set(h,h)}if(s.occlusionTexture!==void 0&&o!==qt&&(c.push(t.assignTexture(a,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&o!==qt){let h=s.emissiveFactor;a.emissive=new we().setRGB(h[0],h[1],h[2],jt)}return s.emissiveTexture!==void 0&&o!==qt&&c.push(t.assignTexture(a,"emissiveMap",s.emissiveTexture,wt)),Promise.all(c).then(function(){let h=new o(a);return s.name&&(h.name=s.name),Vr(h,s),t.associations.set(h,{materials:e}),s.extensions&&vs(r,h,s),h})}createUniqueName(e){let t=lt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,i=this.extensions,r=this.primitiveCache;function s(a){return i[je.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(l){return Bx(l,a,t)})}let o=[];for(let a=0,l=e.length;a<l;a++){let c=e[a],u=lC(c),h=r[u];if(h)o.push(h.promise);else{let d;c.extensions&&c.extensions[je.KHR_DRACO_MESH_COMPRESSION]?d=s(c):d=Bx(new Yt,c,t),r[u]={primitive:c,promise:d},o.push(d)}}return Promise.all(o)}loadMesh(e){let t=this,i=this.json,r=this.extensions,s=i.meshes[e],o=s.primitives,a=[];for(let l=0,c=o.length;l<c;l++){let u=o[l].material===void 0?sC(this.cache):this.getDependency("material",o[l].material);a.push(u)}return a.push(t.loadGeometries(o)),Promise.all(a).then(function(l){let c=l.slice(0,l.length-1),u=l[l.length-1],h=[];for(let p=0,v=u.length;p<v;p++){let _=u[p],m=o[p],f,g=c[p];if(m.mode===Jn.TRIANGLES||m.mode===Jn.TRIANGLE_STRIP||m.mode===Jn.TRIANGLE_FAN||m.mode===void 0)f=s.isSkinnedMesh===!0?new Pu(_,g):new st(_,g),f.isSkinnedMesh===!0&&f.normalizeSkinWeights(),m.mode===Jn.TRIANGLE_STRIP?f.geometry=am(f.geometry,$u):m.mode===Jn.TRIANGLE_FAN&&(f.geometry=am(f.geometry,fl));else if(m.mode===Jn.LINES)f=new Ou(_,g);else if(m.mode===Jn.LINE_STRIP)f=new Oo(_,g);else if(m.mode===Jn.LINE_LOOP)f=new Fu(_,g);else if(m.mode===Jn.POINTS)f=new Dr(_,g);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(f.geometry.morphAttributes).length>0&&aC(f,s),f.name=t.createUniqueName(s.name||"mesh_"+e),Vr(f,s),m.extensions&&vs(r,f,m),t.assignFinalMaterial(f),h.push(f)}for(let p=0,v=h.length;p<v;p++)t.associations.set(h[p],{meshes:e,primitives:p});if(h.length===1)return s.extensions&&vs(r,h[0],s),h[0];let d=new un;s.extensions&&vs(r,d,s),t.associations.set(d,{meshes:e});for(let p=0,v=h.length;p<v;p++)d.add(h[p]);return d})}loadCamera(e){let t,i=this.json.cameras[e],r=i[i.type];if(!r){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new Ft(pl.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):i.type==="orthographic"&&(t=new No(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),Vr(t,i),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],i=[];for(let r=0,s=t.joints.length;r<s;r++)i.push(this._loadNodeShallow(t.joints[r]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(r){let s=r.pop(),o=r,a=[],l=[];for(let c=0,u=o.length;c<u;c++){let h=o[c];if(h){a.push(h);let d=new Ue;s!==null&&d.fromArray(s.array,c*16),l.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Lu(a,l)})}loadAnimation(e){let t=this.json,i=this,r=t.animations[e],s=r.name?r.name:"animation_"+e,o=[],a=[],l=[],c=[],u=[];for(let h=0,d=r.channels.length;h<d;h++){let p=r.channels[h],v=r.samplers[p.sampler],_=p.target,m=_.node,f=r.parameters!==void 0?r.parameters[v.input]:v.input,g=r.parameters!==void 0?r.parameters[v.output]:v.output;_.node!==void 0&&(o.push(this.getDependency("node",m)),a.push(this.getDependency("accessor",f)),l.push(this.getDependency("accessor",g)),c.push(v),u.push(_))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l),Promise.all(c),Promise.all(u)]).then(function(h){let d=h[0],p=h[1],v=h[2],_=h[3],m=h[4],f=[];for(let g=0,y=d.length;g<y;g++){let x=d[g],R=p[g],T=v[g],b=_[g],C=m[g];if(x===void 0)continue;x.updateMatrix&&x.updateMatrix();let E=i._createAnimationTracks(x,R,T,b,C);if(E)for(let M=0;M<E.length;M++)f.push(E[M])}return new ko(s,void 0,f)})}createNodeMesh(e){let t=this.json,i=this,r=t.nodes[e];return r.mesh===void 0?null:i.getDependency("mesh",r.mesh).then(function(s){let o=i._getNodeRef(i.meshCache,r.mesh,s);return r.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let l=0,c=r.weights.length;l<c;l++)a.morphTargetInfluences[l]=r.weights[l]}),o})}loadNode(e){let t=this.json,i=this,r=t.nodes[e],s=i._loadNodeShallow(e),o=[],a=r.children||[];for(let c=0,u=a.length;c<u;c++)o.push(i.getDependency("node",a[c]));let l=r.skin===void 0?Promise.resolve(null):i.getDependency("skin",r.skin);return Promise.all([s,Promise.all(o),l]).then(function(c){let u=c[0],h=c[1],d=c[2];d!==null&&u.traverse(function(p){p.isSkinnedMesh&&p.bind(d,uC)});for(let p=0,v=h.length;p<v;p++)u.add(h[p]);return u})}_loadNodeShallow(e){let t=this.json,i=this.extensions,r=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let s=t.nodes[e],o=s.name?r.createUniqueName(s.name):"",a=[],l=r._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&a.push(l),s.camera!==void 0&&a.push(r.getDependency("camera",s.camera).then(function(c){return r._getNodeRef(r.cameraCache,s.camera,c)})),r._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){a.push(c)}),this.nodeCache[e]=Promise.all(a).then(function(c){let u;if(s.isBone===!0?u=new ol:c.length>1?u=new un:c.length===1?u=c[0]:u=new Tt,u!==c[0])for(let h=0,d=c.length;h<d;h++)u.add(c[h]);if(s.name&&(u.userData.name=s.name,u.name=o),Vr(u,s),s.extensions&&vs(i,u,s),s.matrix!==void 0){let h=new Ue;h.fromArray(s.matrix),u.applyMatrix4(h)}else s.translation!==void 0&&u.position.fromArray(s.translation),s.rotation!==void 0&&u.quaternion.fromArray(s.rotation),s.scale!==void 0&&u.scale.fromArray(s.scale);return r.associations.has(u)||r.associations.set(u,{}),r.associations.get(u).nodes=e,u}),this.nodeCache[e]}loadScene(e){let t=this.extensions,i=this.json.scenes[e],r=this,s=new un;i.name&&(s.name=r.createUniqueName(i.name)),Vr(s,i),i.extensions&&vs(t,s,i);let o=i.nodes||[],a=[];for(let l=0,c=o.length;l<c;l++)a.push(r.getDependency("node",o[l]));return Promise.all(a).then(function(l){for(let u=0,h=l.length;u<h;u++)s.add(l[u]);let c=u=>{let h=new Map;for(let[d,p]of r.associations)(d instanceof zn||d instanceof Dt)&&h.set(d,p);return u.traverse(d=>{let p=r.associations.get(d);p!=null&&h.set(d,p)}),h};return r.associations=c(s),s})}_createAnimationTracks(e,t,i,r,s){let o=[],a=e.name?e.name:e.uuid,l=[];Br[s.path]===Br.weights?e.traverse(function(d){d.morphTargetInfluences&&l.push(d.name?d.name:d.uuid)}):l.push(a);let c;switch(Br[s.path]){case Br.weights:c=Ji;break;case Br.rotation:c=Ai;break;case Br.position:case Br.scale:c=Qi;break;default:i.itemSize===1?c=Ji:c=Qi;break}let u=r.interpolation!==void 0?rC[r.interpolation]:ms,h=this._getArrayFromAccessor(i);for(let d=0,p=l.length;d<p;d++){let v=new c(l[d]+"."+Br[s.path],t.array,h,u);r.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(v),o.push(v)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let i=Um(t.constructor),r=new Float32Array(t.length);for(let s=0,o=t.length;s<o;s++)r[s]=t[s]*i;t=r}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(i){let r=this instanceof Ai?Nm:nh;return new r(this.times,this.values,this.getValueSize()/3,i)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function hC(n,e,t){let i=e.attributes,r=new Rn;if(i.POSITION!==void 0){let a=t.json.accessors[i.POSITION],l=a.min,c=a.max;if(l!==void 0&&c!==void 0){if(r.set(new P(l[0],l[1],l[2]),new P(c[0],c[1],c[2])),a.normalized){let u=Um(Ho[a.componentType]);r.min.multiplyScalar(u),r.max.multiplyScalar(u)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let s=e.targets;if(s!==void 0){let a=new P,l=new P;for(let c=0,u=s.length;c<u;c++){let h=s[c];if(h.POSITION!==void 0){let d=t.json.accessors[h.POSITION],p=d.min,v=d.max;if(p!==void 0&&v!==void 0){if(l.setX(Math.max(Math.abs(p[0]),Math.abs(v[0]))),l.setY(Math.max(Math.abs(p[1]),Math.abs(v[1]))),l.setZ(Math.max(Math.abs(p[2]),Math.abs(v[2]))),d.normalized){let _=Um(Ho[d.componentType]);l.multiplyScalar(_)}a.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(a)}n.boundingBox=r;let o=new kn;r.getCenter(o.center),o.radius=r.min.distanceTo(r.max)/2,n.boundingSphere=o}function Bx(n,e,t){let i=e.attributes,r=[];function s(o,a){return t.getDependency("accessor",o).then(function(l){n.setAttribute(a,l)})}for(let o in i){let a=Dm[o]||o.toLowerCase();a in n.attributes||r.push(s(i[o],a))}if(e.indices!==void 0&&!n.index){let o=t.getDependency("accessor",e.indices).then(function(a){n.setIndex(a)});r.push(o)}return nt.workingColorSpace!==jt&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${nt.workingColorSpace}" not supported.`),Vr(n,e),hC(n,e,t),Promise.all(r).then(function(){return e.targets!==void 0?oC(n,e.targets,t):n})}function Hx(n){let e=new Map,t=new Map,i=n.clone();return Gx(n,i,function(r,s){e.set(s,r),t.set(r,s)}),i.traverse(function(r){if(!r.isSkinnedMesh)return;let s=r,o=e.get(r),a=o.skeleton.bones;s.skeleton=o.skeleton.clone(),s.bindMatrix.copy(o.bindMatrix),s.skeleton.bones=a.map(function(l){return t.get(l)}),s.bind(s.skeleton,s.bindMatrix)}),i}function Gx(n,e,t){t(n,e);for(let i=0;i<n.children.length;i++)Gx(n.children[i],e.children[i],t)}var dC=new th;async function Wx(n,e){return dC.loadAsync("worlds/"+n+".glb",t=>{t.total&&e&&e(t.loaded/t.total)})}function ih(n,e=!0){n.traverse(t=>{if(!(t instanceof st))return;t.castShadow=e,t.receiveShadow=!0;let i=Array.isArray(t.material)?t.material:[t.material];for(let r of i)r.map&&(r.map.anisotropy=4)})}function fC(){let n=document.createElement("canvas");n.width=n.height=48;let e=n.getContext("2d"),t=e.createRadialGradient(24,24,1,24,24,24);t.addColorStop(0,"rgba(17,20,18,.60)"),t.addColorStop(.52,"rgba(19,22,19,.36)"),t.addColorStop(1,"rgba(15,18,16,0)"),e.fillStyle=t,e.fillRect(0,0,48,48);let i=new Fo(n);i.colorSpace=wt;let r=new qt({map:i,depthWrite:!1,transparent:!0,polygonOffset:!0,polygonOffsetFactor:-2,side:yn}),s=new st(new Lo(.9,1.28),r);return s.rotation.x=-Math.PI/2,s.position.set(.02,.035,-.12),s}var pC={hero:0,guard:0},gl=class{constructor(e,t){Z(this,"root",new un);Z(this,"model");Z(this,"mixer");Z(this,"actions",{});Z(this,"active","");Z(this,"height",1.8);this.model=Hx(e.scene),ih(this.model),this.root.add(this.model,fC());let i=new Rn().setFromObject(this.model,!0),r=i.max.y-i.min.y,s=1.8/Math.max(.01,r);this.model.scale.multiplyScalar(s),this.model.position.y-=i.min.y*s,this.model.rotation.y+=pC[t],this.mixer=new Yu(this.model);for(let o of e.animations)this.actions[o.name.toLowerCase()]=this.mixer.clipAction(o);this.motion("idle")}motion(e){if(e===this.active)return;let t=Object.keys(this.actions).find(i=>i.includes(e))??Object.keys(this.actions)[0];t&&(this.actions[this.active]?.fadeOut(.18),this.actions[t].reset().fadeIn(.18).play(),this.active=t)}tick(e){this.mixer.update(e)}dispose(){this.mixer.stopAllAction(),this.mixer.uncacheRoot(this.model)}};function rh(n){let e=new Set,t=new Set,i=new Set;n.traverse(r=>{let s=r;s.geometry&&e.add(s.geometry),s.material&&(Array.isArray(s.material)?s.material:[s.material]).forEach(a=>{t.add(a),Object.values(a).forEach(l=>{l instanceof Dt&&i.add(l)})}),s.isSkinnedMesh&&s.skeleton.dispose()}),e.forEach(r=>r.dispose()),t.forEach(r=>r.dispose()),i.forEach(r=>r.dispose())}var Fm=11,hn=14,sh=(n,e,t)=>n<e?e:n>t?t:n,Go=n=>Math.round(Math.max(0,Math.min(1,n<=.0031308?12.92*n:1.055*n**(1/2.4)-.055))*255);function Xx(n,e,t){return 255<<24|(t&255)<<16|(e&255)<<8|n&255}function mC(n){let i=document.createElement("canvas");i.width=1024,i.height=448;let r=i.getContext("2d"),s=r.createImageData(1024,448),o=s.data,a=_=>[_>>16&255,_>>8&255,_&255],l=a(n.sky[0]),c=a(n.sky[1]),u=a(n.sky[2]),h=new P(...n.sunDirection).normalize(),d=(_,m)=>{let f=Math.sin(_*127.1+m*311.7)*43758.5453;return f-Math.floor(f)},p=(_,m)=>{let f=Math.floor(_),g=Math.floor(m),y=_-f,x=m-g;return y=y*y*(3-2*y),x=x*x*(3-2*x),(d(f,g)*(1-y)+d(f+1,g)*y)*(1-x)+(d(f,g+1)*(1-y)+d(f+1,g+1)*y)*x};for(let _=0;_<448;_++){let m=(.5-_/447)*Math.PI,f=Math.sin(m),g=Math.cos(m),y=sh(f,0,1),x=y**.55;for(let R=0;R<1024;R++){let T=R/1023*Math.PI*2,b=-Math.cos(T)*g,C=Math.sin(T)*g,E=Math.max(0,b*h.x+f*h.y+C*h.z),M=b/(y+.15)*2,L=C/(y+.15)*2,U=p(M,L)*.51+p(M*2.02+7,L*2.02-9)*.28+p(M*4.08,L*4.08+11)*.14+p(M*8.4+3,L*8.4)*.07,I=sh((U-(n.weather==="rain"?.36:.47))*3.4,0,.89)*sh((f+.04)*6,0,1),H=E**4*.29,Y=E**2400;for(let q=0;q<3;q++){let te=(c[q]*(1-x)+l[q]*x)*(1-H)+u[q]*H,k=c[q]*(.76+U*.3)+E**3*28;o[(_*1024+R)*4+q]=te*(1-I)+k*I+Y*(1-I)*100}o[(_*1024+R)*4+3]=255}}r.putImageData(s,0,0);let v=new Fo(i);return v.colorSpace=wt,v}var oh=class{constructor(e){Z(this,"level",e);Z(this,"domElement",document.createElement("canvas"));Z(this,"shadowMap",{enabled:!1,type:hl});Z(this,"outputColorSpace",wt);Z(this,"toneMapping",wi);Z(this,"toneMappingExposure",1);Z(this,"ctx",this.domElement.getContext("2d",{alpha:!1}));Z(this,"w",1);Z(this,"h",1);Z(this,"image",this.ctx.createImageData(1,1));Z(this,"rgb",new Uint32Array(1));Z(this,"z",new Float32Array(1));Z(this,"ratio",1);Z(this,"cssW",1);Z(this,"cssH",1);Z(this,"geo",new WeakMap);Z(this,"materials",new WeakMap);Z(this,"textures",new WeakMap);Z(this,"shadow",null);Z(this,"meshes",[]);Z(this,"transparent",[]);Z(this,"sky");Z(this,"sun");Z(this,"haze");Z(this,"fogLut",new Float32Array(512));Z(this,"view",new Ue);Z(this,"bonesTemp",new Float32Array(16*256));Z(this,"a",new Float32Array(hn*6));Z(this,"b",new Float32Array(hn*6));Z(this,"cacheMat",new Ue);Z(this,"disposed",!1);this.domElement.style.imageRendering="auto",this.sun=new P(...e.sunDirection).normalize(),this.haze=[e.haze>>16&255,e.haze>>8&255,e.haze&255];for(let i=0;i<512;i++)this.fogLut[i]=1-Math.exp(-Math.pow((e.id==="harbor"?.0105:.007)*i,2));let t=new qt({map:mC(e),side:Xt});t.name="sky-vault",this.sky=new st(new Ur(235,48,24),t),this.sky.scale.set(1,1,1),this.initShadow()}async initShadow(){try{let[e,t]=await Promise.all([fetch("worlds/light/shadow.json").then(i=>i.json()),fetch("worlds/light/"+this.level.id+".bin").then(i=>i.arrayBuffer())]);this.disposed||(this.shadow={...e.maps[this.level.id],size:e.size,pixels:new Uint16Array(t)})}catch{}}setPixelRatio(e){this.ratio=e,this.setSize(this.cssW,this.cssH)}setSize(e,t,i=!1){this.cssW=e,this.cssH=t;let r=Math.min(1,Math.sqrt((e/t<.9?23e4:33e4)/(e*t)))*Math.min(1,this.ratio);this.w=Math.max(1,Math.round(e*r)),this.h=Math.max(1,Math.round(t*r)),this.domElement.width=this.w,this.domElement.height=this.h,this.image=this.ctx.createImageData(this.w,this.h),this.rgb=new Uint32Array(this.image.data.buffer),this.z=new Float32Array(this.w*this.h)}texture(e){let t=this.textures.get(e);if(t)return t;let i=e.image,r=[];if(!i?.width)return r;let s=Math.min(1,768/Math.max(i.width,i.height)),o=Math.max(1,Math.round(i.width*s)),a=Math.max(1,Math.round(i.height*s)),l=i;for(let c=0;c<11;c++){let u=document.createElement("canvas");u.width=o,u.height=a;let h=u.getContext("2d",{willReadFrequently:!0});if(c===0&&e.flipY&&e!==this.sky.material.map&&(h.translate(0,a),h.scale(1,-1)),h.drawImage(l,0,0,o,a),r.push({w:o,h:a,pixels:h.getImageData(0,0,o,a).data}),l=u,o<3&&a<3)break;o=Math.max(1,o>>1),a=Math.max(1,a>>1)}return this.textures.set(e,r),r}surface(e){let t=this.materials.get(e);if(t)return t;let i=e,r=i.color??new we(1,1,1);return t={levels:i.map?this.texture(i.map):[],r:Go(r.r)/255,g:Go(r.g)/255,b:Go(r.b)/255,alpha:Math.max(4,(e.alphaTest||0)*255),double:e.side!==Zn,sky:e.name==="sky-vault",unlit:e instanceof qt,transparent:e.transparent&&e.opacity<.95},t.sky&&(t.r=t.g=t.b=1),this.materials.set(e,t),t}batch(e){let t=this.geo.get(e);if(t)return t;let i=e.attributes.position,r=e.attributes.normal,s=e.attributes.uv,o=e.attributes.color,a=e.attributes.skinIndex,l=e.attributes.skinWeight,c=i.count,u=new Float32Array(c*Fm),h=a?new Float32Array(c*4):null,d=l?new Float32Array(c*4):null;for(let _=0;_<c;_++){let m=_*Fm;if(u[m]=i.getX(_),u[m+1]=i.getY(_),u[m+2]=i.getZ(_),u[m+3]=r?.getX(_)??0,u[m+4]=r?.getY(_)??1,u[m+5]=r?.getZ(_)??0,u[m+6]=s?.getX(_)??0,u[m+7]=s?.getY(_)??0,u[m+8]=o?Go(o.getX(_))/255:1,u[m+9]=o?Go(o.getY(_))/255:1,u[m+10]=o?Go(o.getZ(_))/255:1,a&&l&&h&&d)for(let f=0;f<4;f++)h[_*4+f]=a.getComponent(_,f)*16,d[_*4+f]=l.getComponent(_,f)}let p=e.index?Uint32Array.from(e.index.array):Uint32Array.from({length:c},(_,m)=>m),v={base:u,cache:new Float32Array(c*hn),screen:new Float32Array(c*hn),indices:p,bones:h,weights:d,n:c,fixed:!1};return this.geo.set(e,v),v}draw(e){let t=e.geometry;if(!t?.attributes.position?.count)return;let i=this.batch(t),r=i.base,s=i.screen,o=e.matrixWorld.elements,a=this.view.elements,l=this.shadow,c=l?.matrix,u=e,h;if(u.isSkinnedMesh&&i.bones){u.skeleton.update();let M=u.skeleton.bones.length,L=this.bonesTemp;for(let U=0;U<M;U++)this.cacheMat.fromArray(u.skeleton.boneMatrices,U*16).multiply(u.bindMatrix).premultiply(u.bindMatrixInverse),this.cacheMat.toArray(L,U*16);h=L}let d=Array.isArray(e.material)?e.material:[e.material],p=e===this.sky,v=e.userData.softwareStatic===!0,_=this.sun.x,m=this.sun.y,f=this.sun.z,g=i.cache,y=!v||!i.fixed,x=0,R=0,T=0,b=1;for(let M=0;M<i.n;M++){let L=M*Fm,U=M*hn;if(y){let q=r[L],te=r[L+1],k=r[L+2],$=r[L+3],Q=r[L+4],le=r[L+5];if(h&&i.bones&&i.weights){let oe=0,Pe=0,ke=0,F=0,$e=0,ve=0;for(let Je=M*4;Je<M*4+4;Je++){let _e=i.weights[Je];if(!_e)continue;let ye=i.bones[Je];oe+=_e*(h[ye]*q+h[ye+4]*te+h[ye+8]*k+h[ye+12]),Pe+=_e*(h[ye+1]*q+h[ye+5]*te+h[ye+9]*k+h[ye+13]),ke+=_e*(h[ye+2]*q+h[ye+6]*te+h[ye+10]*k+h[ye+14]),F+=_e*(h[ye]*$+h[ye+4]*Q+h[ye+8]*le),$e+=_e*(h[ye+1]*$+h[ye+5]*Q+h[ye+9]*le),ve+=_e*(h[ye+2]*$+h[ye+6]*Q+h[ye+10]*le)}q=oe,te=Pe,k=ke,$=F,Q=$e,le=ve}x=o[0]*q+o[4]*te+o[8]*k+o[12],R=o[1]*q+o[5]*te+o[9]*k+o[13],T=o[2]*q+o[6]*te+o[10]*k+o[14];let be=o[0]*$+o[4]*Q+o[8]*le,Te=o[1]*$+o[5]*Q+o[9]*le,X=o[2]*$+o[6]*Q+o[10]*le,re=1/(Math.sqrt(be*be+Te*Te+X*X)||1),pe=Math.max(0,(be*_+Te*m+X*f)*re);b=p?1:.65+.14*(Te*re+1)*.5+.32*pe,g[U]=x,g[U+1]=R,g[U+2]=T,g[U+3]=r[L+6],g[U+4]=p?1-r[L+7]:r[L+7],g[U+5]=r[L+8]*b,g[U+6]=r[L+9]*b,g[U+7]=r[L+10]*b,g[U+11]=pe,g[U+12]=0}else x=g[U],R=g[U+1],T=g[U+2];c&&(!v||!i.fixed||g[U+12]===0)&&(g[U+8]=c[0]*x+c[4]*R+c[8]*T+c[12],g[U+9]=c[1]*x+c[5]*R+c[9]*T+c[13],g[U+10]=c[2]*x+c[6]*R+c[10]*T+c[14]-(.24+.31*(1-g[U+11]))/l.depthSpan,g[U+12]=1);let I=a[0]*x+a[4]*R+a[8]*T+a[12],H=a[1]*x+a[5]*R+a[9]*T+a[13],Y=a[3]*x+a[7]*R+a[11]*T+a[15];s[U]=I,s[U+1]=H,s[U+2]=Y;for(let q=3;q<11;q++)s[U+q]=g[U+q];if(Y>=.035){let q=1/Y;s[U+11]=(I*q*.5+.5)*this.w,s[U+12]=(.5-H*q*.5)*this.h,s[U+13]=q}}v&&(i.fixed=!0);let C=i.indices,E=Array.isArray(e.material)?t.groups:[{start:0,count:C.length,materialIndex:0}];for(let M of E){let L=d[M.materialIndex??0];if(!L||!L.visible||L.opacity<.07)continue;let U=this.surface(L);for(let I=M.start,H=Math.min(C.length,M.start+M.count);I<H;I+=3){let Y=C[I]*hn,q=C[I+1]*hn,te=C[I+2]*hn,k=s[Y+2],$=s[q+2],Q=s[te+2];k<.035&&$<.035&&Q<.035||(k>=.035&&$>=.035&&Q>=.035?this.tri(s,Y,q,te,U,L.opacity):this.clip(s,Y,q,te,U,L.opacity))}}}clip(e,t,i,r,s,o){let a=this.a,l=this.b,c=0;for(let u=0;u<3;u++){let h=u===0?t:u===1?i:r;for(let d=0;d<11;d++)a[u*hn+d]=e[h+d]}for(let u=0;u<3;u++){let h=(u+2)%3*hn,d=u*hn,p=a[h+2],v=a[d+2];if(p>=.035!=v>=.035){let _=(.035-p)/(v-p),m=c++*hn;for(let f=0;f<11;f++)l[m+f]=a[h+f]+_*(a[d+f]-a[h+f])}if(v>=.035){let _=c++*hn;for(let m=0;m<11;m++)l[_+m]=a[d+m]}}for(let u=0;u<c;u++){let h=u*hn,d=1/l[h+2];l[h+11]=(l[h]*d*.5+.5)*this.w,l[h+12]=(.5-l[h+1]*d*.5)*this.h,l[h+13]=d}for(let u=1;u<c-1;u++)this.tri(l,0,u*hn,(u+1)*hn,s,o)}tri(e,t,i,r,s,o){let a=e[t+11],l=e[t+12],c=e[i+11],u=e[i+12],h=e[r+11],d=e[r+12],p=(c-a)*(d-l)-(h-a)*(u-l);if(Math.abs(p)<.08||!s.double&&p>0)return;let v=Math.max(0,Math.ceil(Math.min(a,c,h)-.5)),_=Math.min(this.w-1,Math.floor(Math.max(a,c,h)-.5)),m=Math.max(0,Math.ceil(Math.min(l,u,d)-.5)),f=Math.min(this.h-1,Math.floor(Math.max(l,u,d)-.5));if(v>_||m>f)return;let g=1/p,y=(u-d)*g,x=(d-l)*g,R=(h-c)*g,T=(a-h)*g,b=((c-v-.5)*(d-m-.5)-(u-m-.5)*(h-v-.5))*g,C=((h-v-.5)*(l-m-.5)-(d-m-.5)*(a-v-.5))*g,E=e[t+13],M=e[i+13],L=e[r+13],U=s.levels,I=U[0];if(I&&U.length>1&&!s.sky){let Ne=Math.abs((e[i+3]-e[t+3])*(e[r+4]-e[t+4])-(e[i+4]-e[t+4])*(e[r+3]-e[t+3])),se=sh(Math.floor(.5*Math.log2(Ne*I.w*I.h/Math.abs(p)+1e-5)),0,U.length-1);I=U[se]}let H=this.fogLut,Y=this.haze,q=this.shadow,te=q?.pixels,k=q?.size??0,$=this.rgb,Q=this.z,le=I?.w??1,be=I?.h??1,Te=I?.pixels,X=e[t+3],re=e[i+3],pe=e[r+3],oe=e[t+4],Pe=e[i+4],ke=e[r+4],F=e[t+5],$e=e[i+5],ve=e[r+5],Je=e[t+6],_e=e[i+6],ye=e[r+6],Oe=e[t+7],Xe=e[i+7],ut=e[r+7],w=e[t+8],S=e[i+8],D=e[r+8],G=e[t+9],J=e[i+9],ee=e[r+9],Ae=e[t+10],de=e[i+10],he=e[r+10];for(let Ne=m;Ne<=f;Ne++,b+=R,C+=T){let se=b,Me=C;for(let Ye=v,Ee=Ne*this.w+Ye;Ye<=_;Ye++,Ee++,se+=y,Me+=x){let me=1-se-Me;if(se<-1e-5||Me<-1e-5||me<-1e-5)continue;let Re=se*E,Ie=Me*M,tt=me*L,Fe=Re+Ie+tt;if(Fe<=Q[Ee])continue;let N=1/Fe;Re*=N,Ie*=N,tt*=N;let K=255,j=255,ae=255,ce=o;if(Te){let De=Re*X+Ie*re+tt*pe,Ke=Re*oe+Ie*Pe+tt*ke;De-=Math.floor(De),Ke-=Math.floor(Ke);let it=De*le,gt=Ke*be,We=it|0,Vt=gt|0,vt=(Vt*le+We)*4;if(Te[vt+3]<s.alpha)continue;if(K=Te[vt],j=Te[vt+1],ae=Te[vt+2],ce*=Te[vt+3]/255,s.sky||le>=64&&N<48){let Pt=it-We,xn=gt-Vt,fi=(We+1)%le,Hr=(Vt+1)%be,_s=(Vt*le+fi)*4,tr=(Hr*le+We)*4,xs=(Hr*le+fi)*4;K=(K*(1-Pt)+Te[_s]*Pt)*(1-xn)+(Te[tr]*(1-Pt)+Te[xs]*Pt)*xn,j=(j*(1-Pt)+Te[_s+1]*Pt)*(1-xn)+(Te[tr+1]*(1-Pt)+Te[xs+1]*Pt)*xn,ae=(ae*(1-Pt)+Te[_s+2]*Pt)*(1-xn)+(Te[tr+2]*(1-Pt)+Te[xs+2]*Pt)*xn}}if(!s.sky){let De=1;if(te&&!s.unlit){let it=(Re*w+Ie*S+tt*D)*k-.5,gt=(Re*G+Ie*J+tt*ee)*k-.5;if(it>=0&&gt>=0&&it<k-1&&gt<k-1){let We=(Re*Ae+Ie*de+tt*he)*65535,Vt=it|0,vt=gt|0,Pt=vt*k+Vt,xn=it-Vt,fi=gt-vt;De=1-.34*((We>te[Pt]?(1-xn)*(1-fi):0)+(We>te[Pt+1]?xn*(1-fi):0)+(We>te[Pt+k]?(1-xn)*fi:0)+(We>te[Pt+k+1]?xn*fi:0))}}let Ke=H[Math.min(511,N|0)];K=K*s.r*(Re*F+Ie*$e+tt*ve)*De*(1-Ke)+Y[0]*Ke,j=j*s.g*(Re*Je+Ie*_e+tt*ye)*De*(1-Ke)+Y[1]*Ke,ae=ae*s.b*(Re*Oe+Ie*Xe+tt*ut)*De*(1-Ke)+Y[2]*Ke}if(ce<.99){let De=$[Ee];K=K*ce+(De&255)*(1-ce),j=j*ce+(De>>>8&255)*(1-ce),ae=ae*ce+(De>>>16&255)*(1-ce)}$[Ee]=Xx(Math.min(255,K),Math.min(255,j),Math.min(255,ae)),ce>.4&&(Q[Ee]=Fe)}}}render(e,t){e.updateMatrixWorld(!0),t.updateMatrixWorld(),this.view.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this.rgb.fill(Xx(...this.haze)),this.z.fill(0),this.sky.position.copy(t.position),this.sky.updateMatrixWorld(),this.draw(this.sky),this.meshes.length=this.transparent.length=0,e.traverseVisible(i=>{i instanceof st&&!(i.material instanceof _n)&&(i.material.transparent?this.transparent.push(i):this.meshes.push(i))});for(let i of this.meshes)this.draw(i);for(let i of this.transparent)this.draw(i);this.ctx.putImageData(this.image,0,0),e.traverseVisible(i=>{if(!(i instanceof Dr))return;let r=i.geometry.attributes.position,s=new P;this.ctx.fillStyle=this.level.weather==="snow"?"rgba(255,255,255,.45)":"rgba(203,218,221,.21)";for(let o=0;o<r.count;o++)s.fromBufferAttribute(r,o).applyMatrix4(i.matrixWorld).project(t),!(s.z<0||s.z>1||Math.abs(s.x)>1||Math.abs(s.y)>1)&&this.ctx.fillRect((s.x*.5+.5)*this.w,(.5-s.y*.5)*this.h,1,this.level.weather==="snow"?1.6:4)})}dispose(){this.disposed=!0,this.sky.geometry.dispose(),this.sky.material.map?.dispose(),this.sky.material.dispose()}forceContextLoss(){}};var gC="varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",vC=`varying vec3 ray;
uniform vec3 zenith,horizon,warm,sundir;uniform float phase,overcast;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float cloud(vec2 p){return .52*noise(p)+.26*noise(2.02*p+14.)+.14*noise(4.15*p-8.)+.08*noise(8.3*p+27.);}
void main(){vec3 n=normalize(ray);float h=max(n.y,0.);float s=max(dot(n,sundir),0.);vec3 col=mix(horizon,zenith,pow(h,.55));col=mix(col,warm,.45*pow(s,6.));vec2 uv=n.xz/(h+.17)*1.6+vec2(phase*.004,0.);float c=cloud(uv);float density=smoothstep(.43-overcast*.08,.76,c)*smoothstep(-.04,.18,n.y);vec3 cloudColor=mix(horizon*.73,vec3(1.0,.96,.85),.2+.5*pow(s,3.)+.25*c);col=mix(col,cloudColor,density*.88);col+=vec3(1.,.80,.53)*(.16*pow(s,30.)+.62*pow(s,650.))*(1.-.65*density);gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,ah=class{constructor(e,t,i){Z(this,"world",e);Z(this,"level",t);Z(this,"sky");Z(this,"weather",null);Z(this,"weatherBuf",null);Z(this,"time",0);Z(this,"flock",[]);Z(this,"cube",null);Z(this,"shadow");let r=new _n({side:Xt,depthWrite:!1,uniforms:{zenith:{value:new we(t.sky[0])},horizon:{value:new we(t.sky[1])},warm:{value:new we(t.sky[2])},sundir:{value:new P(...t.sunDirection).normalize()},phase:{value:0},overcast:{value:t.weather==="rain"?1:0}},vertexShader:gC,fragmentShader:vC});this.sky=new st(new Ur(260,32,18),r),this.sky.renderOrder=-20,e.add(this.sky);let s=new Uo;s.background=new we(t.haze);let o=this.sky.clone();if(s.add(o),i){let l=new Do(i);this.cube=l.fromScene(s,.06,.1,400),e.environment=this.cube.texture,l.dispose()}e.fog=new Cu(t.haze,t.id==="harbor"?.0105:.007),e.add(new Gu(16775403,t.ground,1.38)),this.shadow=new Bo(t.sun,t.weather==="rain"?2.25:2.7),this.shadow.position.set(...t.sunDirection),this.shadow.target.position.set(0,0,-5),this.shadow.castShadow=!0;let a=this.shadow.shadow;if(a.mapSize.set(1024,1024),Object.assign(a.camera,{left:-29,right:29,top:32,bottom:-32,near:2,far:145}),a.normalBias=.025,a.bias=-6e-4,e.add(this.shadow,this.shadow.target),t.weather!=="clear"){let l=t.weather==="snow"?195:115,c=new Float32Array(l*3);for(let d=0;d<l;d++)c[d*3]=(Math.random()-.5)*29,c[d*3+1]=Math.random()*13,c[d*3+2]=(Math.random()-.5)*29;let u=new Yt;u.setAttribute("position",new Ct(c,3)),this.weatherBuf=c;let h=new _n({transparent:!0,depthWrite:!1,uniforms:{isSnow:{value:t.weather==="snow"?1:0}},vertexShader:"uniform float isSnow;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((isSnow>.5?22.:55.)/max(2.,-mv.z),1.,7.);}",fragmentShader:"uniform float isSnow;void main(){vec2 p=gl_PointCoord-.5;float a=isSnow>.5?(1.-smoothstep(.18,.5,length(p)))*.49:(1.-smoothstep(.02,.1,abs(p.x+p.y*.13)))*.35;gl_FragColor=vec4(.87,.91,.93,a);}"});this.weather=new Dr(u,h),this.weather.frustumCulled=!1,e.add(this.weather)}if(t.id==="harbor"||t.id==="airfield"){let l=new Ti({color:14737358,roughness:1,side:yn});for(let c=0;c<5;c++){let u=new un;for(let h of[-1,1]){let d=new Yt;d.setAttribute("position",new Et([0,0,0,h*.4,.15,-.04,h*.81,.1,.15,0,0,0,h*.81,.1,.15,h*.32,.05,.18],3)),d.computeVertexNormals(),u.add(new st(d,l))}e.add(u),this.flock.push(u)}}}update(e,t){if(this.time+=e,this.sky.material.uniforms.phase.value=this.time,this.sky.position.set(t.x,0,t.z),this.flock.forEach((i,r)=>{let s=this.time*.075+r*.61;i.position.set(Math.sin(s)*24-6,9+Math.sin(s+r)*2+r*.64,-28+Math.cos(s)*12),i.rotation.y=-s+.5;for(let o=0;o<2;o++)i.children[o].rotation.z=(o?1:-1)*Math.sin(this.time*3+r)*.2}),this.weather&&this.weatherBuf){this.weather.position.set(t.x,0,t.z);let i=this.level.weather==="snow",r=this.weatherBuf;for(let s=0;s<r.length;s+=3)r[s+1]-=e*(i?.72:8.3),r[s]+=e*(i?.08:-.45),r[s+1]<0&&(r[s+1]=13,r[s]=(Math.random()-.5)*28,r[s+2]=(Math.random()-.5)*28);this.weather.geometry.attributes.position.needsUpdate=!0}}dispose(){this.cube?.dispose(),this.shadow.shadow.map?.dispose()}};var qx=n=>Math.max(0,Math.min(1,n)),km=n=>{let e=qx(n);return e*e*(3-2*e)};function zm(n){let e=qx(n/.66);return{travel:.04+.89*km(e),blend:km(e/.19)*km((1-e)/.22)}}var yC=new P(0,1,0),bt=(n=0,e=0,t=0)=>new P(n,e,t),ys=pl.clamp,lh=class{constructor(e,t,i,r,s,o){Z(this,"holder",e);Z(this,"labels",t);Z(this,"compass",i);Z(this,"range",r);Z(this,"mission",s);Z(this,"cb",o);Z(this,"status",{ammo:7,hp:100,hits:0,shots:0,score:0,phase:"hunt",scope:!1,mode:"third",reloading:!1,total:3});Z(this,"paused",!1);Z(this,"stopped",!1);Z(this,"ready",!1);Z(this,"raf",0);Z(this,"oldTime",0);Z(this,"accumulator",0);Z(this,"time",0);Z(this,"renderer");Z(this,"scene",new Uo);Z(this,"camera",new Ft(60,1,.035,420));Z(this,"atmo");Z(this,"observer");Z(this,"width",1);Z(this,"height",1);Z(this,"ratio",1);Z(this,"frames",0);Z(this,"slowFrames",0);Z(this,"player",null);Z(this,"fp",null);Z(this,"foes",[]);Z(this,"layouts",null);Z(this,"position",bt(0,0,10));Z(this,"yaw",0);Z(this,"pitch",-.018);Z(this,"ySpeed",0);Z(this,"speed",0);Z(this,"step",0);Z(this,"direction",bt(0,0,-1));Z(this,"right",bt(1,0,0));Z(this,"input",new Le);Z(this,"keys",new Set);Z(this,"lastShot",-10);Z(this,"recoil",0);Z(this,"reloadEnd",0);Z(this,"ray",new ju);Z(this,"bodyRay",new $i);Z(this,"floorHits",[]);Z(this,"exitFlag");Z(this,"exitPos",bt());Z(this,"exitLabel");Z(this,"streaks",[]);Z(this,"shotMat",new qt({color:16760939,toneMapped:!1}));Z(this,"enemyMat",new qt({color:14453855,toneMapped:!1}));Z(this,"streakShape",new Ur(.045,8,5));Z(this,"film",null);Z(this,"reduced",matchMedia("(prefers-reduced-motion: reduce)").matches);Z(this,"alerts",!1);Z(this,"lost",e=>{e.preventDefault(),this.paused=!0,this.cb.error("Pamja 3D u nd\xEBrpre. Rihap sken\xEBn p\xEBr t\xEB vazhduar.")});Z(this,"frame",e=>{if(this.stopped)return;let t=(e-(this.oldTime||e))/1e3;this.oldTime=e;let i=Math.min(.07,t);if(!this.paused&&!document.hidden){if(this.ready&&(this.status.phase==="hunt"||this.status.phase==="extract")){for(this.accumulator+=i;this.accumulator>=1/60;)this.time+=1/60,this.film||this.advance(1/60),this.updateFoes(1/60),this.accumulator-=1/60;this.reloadEnd&&this.time>=this.reloadEnd&&(this.status.ammo=7,this.status.reloading=!1,this.reloadEnd=0,this.emit()),this.film&&(this.film.age+=i,this.film.age>=.66&&(this.film=null)),this.recoil=Math.max(0,this.recoil-i*5.8),this.updateCamera(i),this.atmo.update(i,this.position),this.exitFlag.visible&&(this.exitFlag.rotation.y+=i*.28);for(let r of this.streaks)r.age+=i,r.mesh.position.lerpVectors(r.start,r.end,r.cinematic?zm(r.age).travel:ys(r.age/r.life,0,1)),r.age>=r.life&&this.scene.remove(r.mesh);this.streaks=this.streaks.filter(r=>r.age<r.life),this.tags(),this.frames++,t>.058&&this.slowFrames++,this.frames===120&&(this.slowFrames>42&&this.ratio>.86&&(this.ratio=Math.max(.85,this.ratio*.83),this.renderer.setPixelRatio(this.ratio)),this.frames=this.slowFrames=0)}this.ready&&this.renderer.render(this.scene,this.camera)}this.raf=requestAnimationFrame(this.frame)});this.yaw={harbor:-.26,airfield:-.11,alpine:-.17,valley:-.065}[s.id]||0,s.id==="harbor"&&(this.position.x=-1.25);let a=null;try{let l=document.createElement("canvas"),c=l.getContext("webgl2",{antialias:!0,alpha:!1,powerPreference:"high-performance"});c&&(a=new Ru({canvas:l,context:c,antialias:!0,alpha:!1,powerPreference:"high-performance"}))}catch{}this.renderer=a??new oh(s),this.renderer.outputColorSpace=wt,this.renderer.toneMapping=Qp,this.renderer.toneMappingExposure=1.05,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=hl,this.renderer.domElement.setAttribute("aria-label","Bota 3D"),e.prepend(this.renderer.domElement),this.renderer.domElement.addEventListener("webglcontextlost",this.lost),this.scene.add(this.camera),this.atmo=new ah(this.scene,s,a),this.exitFlag=this.buildExit(),this.exitLabel=document.createElement("div"),this.exitLabel.className="exit-tag",this.exitLabel.textContent="DALJA",t.appendChild(this.exitLabel),this.exitLabel.hidden=!0,this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(e),this.resize(),this.updateCamera(1),this.load(),this.raf=requestAnimationFrame(this.frame)}async load(){let e=[];try{let t=[0,0,0,0],i=[.43,.25,.23,.09],r=0,s=(p,v)=>{if(this.stopped)return;t[p]=Math.max(t[p],ys(v,0,1));let _=Math.floor(t.reduce((m,f,g)=>m+f*i[g],0)*96);_>=r+3&&(r=_,this.cb.loading(_<45?"Po ngarkohet ambienti 3D\u2026":"Po p\xEBrgatiten personazhet\u2026",_))},o=async(p,v)=>{let _=await Wx(p,m=>s(v,m));return this.stopped?(rh(_.scene),_):(e.push(_.scene),s(v,1),_)},[a,l,c,u,h]=await Promise.all([o(this.mission.id,0),o("hero",1),o("guard",2),o("rig-fpv",3),fetch("worlds/"+this.mission.id+".json").then(p=>{if(!p.ok)throw Error("layout");return p.json()})]);if(this.stopped)return;this.layouts=h,ih(a.scene),a.scene.traverse(p=>{if(p instanceof st){p.userData.softwareStatic=!0;let v=(p.name+" "+(Array.isArray(p.material)?p.material.map(_=>_.name).join(" "):p.material.name)).toLowerCase();/water|ocean|cloud|mountain|terrainfar|horizon|distant/.test(v)&&(p.castShadow=!1),this.floorHits.push(p)}}),this.scene.add(a.scene),this.player=new gl(l,"hero"),this.scene.add(this.player.root),this.player.root.position.copy(this.position),this.player.root.rotation.y=Math.PI-this.yaw,this.fp=u.scene,this.fp.visible=!1,ih(this.fp,!1),this.camera.add(this.fp),this.foes=h.patrols.slice(0,3).map((p,v)=>{let _=new gl(c,"guard"),m=bt(p[0],0,p[1]),f=bt(p[2],0,p[3]),g=[.28,.54,.81][v];_.root.position.lerpVectors(m,f,g),this.scene.add(_.root),_.motion("walk");let y=document.createElement("div");return y.className="foe-tag",y.setAttribute("aria-hidden","true"),y.innerHTML="<i></i>",this.labels.appendChild(y),{actor:_,start:m,end:f,t:g,direction:v%2?-1:1,down:-1,cool:3+v*1.5,alert:0,visible:!0,tag:y}}),this.status.total=this.foes.length;let d=h.patrols[h.patrols.length-1];this.exitPos.set(d[2],0,d[3]);for(let p of[h.bounds[2]+4,h.bounds[2]+7,-14])if(this.canStand(.4,p)){this.exitPos.set(.4,0,p);break}this.exitFlag.position.copy(this.exitPos),this.exitFlag.visible=!1,this.scene.add(this.exitFlag),this.ready=!0,this.updateCamera(1),this.cb.loading("Gati",100),this.cb.stats({...this.status}),this.cb.ready(),e=[]}catch(t){this.stopped||(e.forEach(i=>{i.parent||rh(i)}),this.cb.error("Nj\xEB nga modelet 3D nuk u hap. Provo ta ngarkosh s\xEBrish."),console.error(t))}}buildExit(){let e=new un,t=new Ti({color:13940342,metalness:.3,roughness:.53,emissive:3881503}),i=new st(new zu(1.25,.034,7,64),t);i.rotation.x=-Math.PI/2,i.position.y=.08,e.add(i);for(let r=0;r<3;r++){let s=new st(new ku(.1),t);s.position.set(Math.cos(r*2.094)*1.25,.24,Math.sin(r*2.094)*1.25),e.add(s)}return e}resize(){this.width=this.holder.clientWidth||1,this.height=this.holder.clientHeight||1,this.ratio=Math.min(devicePixelRatio,this.width<700?1.55:1.28),this.renderer.setPixelRatio(this.ratio),this.renderer.setSize(this.width,this.height,!1),this.camera.aspect=this.width/this.height,this.camera.updateProjectionMatrix()}emit(){this.cb.stats({...this.status})}key(e,t){t?this.keys.add(e):this.keys.delete(e)}stick(e,t){this.input.set(e,t),this.input.length()>1&&this.input.normalize()}drag(e,t){if(this.paused||!this.ready||this.film)return;let i=(this.status.scope?.00165:.00365)*(this.width<560?1.12:1);this.yaw+=e*i,this.pitch=ys(this.pitch-t*i,-.79,.76)}clear(){this.input.set(0,0),this.keys.clear()}toggleCamera(){if(!(!this.ready||this.paused)){this.status.mode=this.status.mode==="third"?"first":"third",this.status.scope=!1,this.film=null;for(let e of this.streaks)e.cinematic&&(e.age=e.life);this.updateCamera(1),this.emit(),this.cb.notice(this.status.mode==="first"?"Pamja nga syt\xEB":"Pamja pas lojtarit")}}scope(){!this.ready||this.paused||this.film||(this.status.scope=!this.status.scope,this.cb.sound("zoom"),this.updateCamera(.05),this.emit())}jump(){!this.ready||this.paused||this.position.y>.025||(this.ySpeed=4.1)}reload(){!this.ready||this.paused||this.reloadEnd||this.status.ammo===7||this.status.phase!=="hunt"||(this.status.reloading=!0,this.reloadEnd=this.time+1.05,this.cb.sound("load"),this.cb.notice("Duke rimbushur\u2026"),this.emit())}inside(e,t,i,r){return Math.abs(e-i[0])<i[2]/2+r&&Math.abs(t-i[1])<i[3]/2+r}canStand(e,t){if(!this.layouts)return!0;let[i,r,s,o]=this.layouts.bounds;return e<i+.3||e>r-.3||t<s+.3||t>o-.3?!1:!this.layouts.blocks.some(a=>this.inside(e,t,a,.29))}advance(e){let t=_=>Number(this.keys.has(_)),i=this.input.x+t("d")-t("a"),r=-this.input.y+t("w")-t("s")+t("ArrowUp")-t("ArrowDown"),s=Math.hypot(i,r),o=this.status.scope?1.45:this.keys.has("Shift")||s>.87?4.1:2.35;this.yaw+=e*(t("ArrowRight")-t("ArrowLeft"))*1.6;let a=Math.sin(this.yaw),l=Math.cos(this.yaw),c=Math.max(1,s),u=(l*i+a*r)/c*o*e,h=(a*i-l*r)/c*o*e,d=this.position.x,p=this.position.z;this.canStand(d+u,p)&&(this.position.x+=u),this.canStand(this.position.x,p+h)&&(this.position.z+=h),this.speed=Math.hypot(this.position.x-d,this.position.z-p)/e,this.ySpeed-=12*e,this.position.y+=this.ySpeed*e,this.position.y<=0&&(this.position.y=0,this.ySpeed=0),this.step+=this.speed*e*2.4;let v=this.player;v.root.position.copy(this.position),v.root.rotation.y=Math.PI-this.yaw,v.motion(this.speed>2.8?"run":this.speed>.15?"walk":"idle"),v.tick(e),this.status.phase==="extract"&&Math.hypot(this.position.x-this.exitPos.x,this.position.z-this.exitPos.z)<1.7&&(this.status.phase="won",this.status.score+=250,this.emit(),this.cb.sound("finish"))}wall(e,t){if(!this.layouts)return!1;for(let i of this.layouts.blocks){let[r,s,o,a]=i,l=t.x-e.x,c=t.z-e.z,u=.003,h=.994,d=(p,v,_,m)=>{if(Math.abs(v)<1e-5)return p>=_&&p<=m;let f=(_-p)/v,g=(m-p)/v;return u=Math.max(u,Math.min(f,g)),h=Math.min(h,Math.max(f,g)),u<=h};if(d(e.x,l,r-o*.5,r+o*.5)&&d(e.z,c,s-a*.5,s+a*.5))return!0}return!1}updateFoes(e){for(let t of this.foes){if(t.down>=0){t.down+=e,t.actor.root.rotation.z=-1.3*ys(t.down/.51,0,1),t.actor.root.position.y=-.15*ys(t.down/.51,0,1),t.down>1.4&&(t.actor.root.visible=!1);continue}let i=t.actor.root.position,r=t.start.distanceTo(t.end),s=i.distanceTo(this.position),o=this.alerts&&s<21&&!this.wall(i,this.position)&&this.status.phase==="hunt";if(t.alert=o?Math.min(1,t.alert+e):Math.max(0,t.alert-e*.6),t.alert>.79){if(t.actor.motion("idle"),t.actor.root.rotation.y=Math.atan2(this.position.x-i.x,this.position.z-i.z),t.cool-=e,t.cool<=0&&!this.film){t.cool=3.9+Math.random()*2.4;let a=i.clone().add(bt(0,1.33,0)),l=this.position.clone().add(bt(.02,1.15,0));this.streak(a,l,!0),this.status.hp=Math.max(0,this.status.hp-(this.speed>2?3:7)),this.status.hp===0&&(this.status.phase="lost"),this.holder.classList.remove("damaged"),this.holder.offsetWidth,this.holder.classList.add("damaged"),this.emit()}}else t.t+=t.direction*e*.8/Math.max(1,r),(t.t>1||t.t<0)&&(t.t=ys(t.t,0,1),t.direction*=-1),i.lerpVectors(t.start,t.end,t.t),t.actor.root.rotation.y=Math.atan2((t.end.x-t.start.x)*t.direction,(t.end.z-t.start.z)*t.direction),t.actor.motion("walk");t.actor.tick(e)}}updateCamera(e){let t=Math.sin(this.yaw),i=Math.cos(this.yaw),r=Math.cos(this.pitch);this.direction.set(t*r,Math.sin(this.pitch),-i*r),this.right.set(i,0,t);let s=this.status.mode==="first"||this.status.scope,o=this.reduced?0:Math.min(1,this.speed/3)*Math.sin(this.step)*.027,a=this.position.clone().add(bt(0,1.61+o,0)),l=a.clone().addScaledVector(this.direction,14);if(s)this.camera.position.copy(a);else{let u=bt(-t*3.95+i*.53,.78,i*3.95+t*.53),h=1;for(let d=.17;d<=1;d+=.1){let p=a.clone().addScaledVector(u,d);if(this.layouts?.blocks.some(v=>this.inside(p.x,p.z,v,.1))){h=Math.max(.13,d-.13);break}}this.camera.position.copy(a).addScaledVector(u,h)}this.camera.lookAt(l),this.recoil>0&&this.camera.rotateX(this.recoil*.012);let c=this.status.scope?24:this.width/this.height<.85?66:56;if(this.camera.fov=pl.lerp(this.camera.fov,c,e===1?1:1-Math.exp(-16*e)),this.camera.updateProjectionMatrix(),this.film){let u=this.film,h=zm(u.age),d=bt().lerpVectors(u.start,u.end,h.travel),p=bt().crossVectors(yC,u.dir).normalize(),v=d.clone().addScaledVector(u.dir,-.82).addScaledVector(p,.19);v.y+=.11,this.camera.position.lerp(v,h.blend),this.camera.lookAt(l.clone().lerp(d,h.blend))}this.player&&(this.player.root.visible=!s&&!this.film),this.fp&&(this.fp.visible=s&&!this.status.scope&&!this.film,this.fp.position.set(Math.sin(this.step/2)*Math.min(1,this.speed)*.006,-this.recoil*.012+o*.27,this.recoil*.07),this.fp.rotation.x=this.recoil*.065),this.camera.updateMatrixWorld()}streak(e,t,i=!1,r=!1){let s=new st(this.streakShape,i?this.enemyMat:this.shotMat);s.scale.set(1,1,r?4.8:3),s.position.copy(e),s.lookAt(t),this.scene.add(s),this.streaks.push({mesh:s,start:e,end:t,age:0,life:r?.66:i?.24:.13,cinematic:r})}obstacle(e,t){this.ray.ray.copy(e),this.ray.near=.12,this.ray.far=t;let i=this.ray.intersectObjects(this.floorHits,!1)[0];return i?i.distance:t}shoot(e){if(!this.ready||this.paused||this.film||this.status.phase!=="hunt"||this.status.reloading||this.time-this.lastShot<.28)return;if(this.status.ammo===0){this.reload();return}this.lastShot=this.time,this.status.ammo--,this.status.shots++,this.alerts=!0,this.recoil=1,this.ray.setFromCamera(e||new Le,this.camera),this.bodyRay.copy(this.ray.ray);let t,i=100,r=bt(),s=bt();for(let u of this.foes){if(u.down>=0)continue;let h=u.actor.root.position,d=h.clone().add(bt(0,.35,0)),p=h.clone().add(bt(0,1.55,0)),v=bt(),_=this.bodyRay.distanceSqToSegment(d,p,v,s),m=v.distanceTo(this.bodyRay.origin),f=this.width<650?Math.min(.18,m*.009):.035;_<(.36+f)**2&&m<i&&(t=u,i=m,r.copy(v))}let o=this.obstacle(this.bodyRay,t?i-.22:70);t&&o<i-.24&&(t=void 0);let a=t?r:this.bodyRay.at(o,bt());if(e){let u=this.position.clone().add(bt(0,1.6,0)),h=a.clone().sub(u).normalize();this.yaw=Math.atan2(h.x,-h.z),this.pitch=ys(Math.asin(h.y),-.79,.76)}let l=this.position.clone().addScaledVector(this.direction,.62).addScaledVector(this.right,.18).add(bt(0,1.34,0)),c=!!t&&!this.reduced&&l.distanceToSquared(a)>4;this.streak(l,a,!1,c),t?(t.down=0,t.tag.hidden=!0,this.status.hits++,this.status.score+=150,this.cb.sound("hit"),this.cb.notice("Goditje  +150"),c&&(this.film={start:l,end:a,dir:a.clone().sub(l).normalize(),age:0}),this.status.hits===this.status.total&&(this.status.phase="extract",this.status.scope=!1,this.exitFlag.visible=!0,this.cb.notice("Zona u pastrua \xB7 Shko te dalja"))):(this.cb.sound("miss"),this.status.ammo||this.cb.notice("Prek p\xEBr t\xEB rimbushur")),this.emit()}tags(){let e=(r,s,o)=>{if(!o){r.hidden=!0;return}let a=s.project(this.camera);r.hidden=a.z>1||a.z<0||Math.abs(a.x)>1.04||Math.abs(a.y)>1,r.hidden||(r.style.transform="translate3d("+(a.x*.5+.5)*this.width+"px,"+(.5-a.y*.5)*this.height+"px,0)")},t=1/0;for(let r of this.foes){if(r.down>=0){r.tag.hidden=!0;continue}let s=r.actor.root.position;t=Math.min(t,this.position.distanceTo(s)),e(r.tag,s.clone().add(bt(0,2.13,0)),!this.film&&!this.wall(this.position,s))}this.status.phase==="extract"?(t=this.position.distanceTo(this.exitPos),this.exitLabel.textContent="DALJA \xB7 "+Math.round(t)+" m",e(this.exitLabel,this.exitPos.clone().add(bt(0,1.5,0)),!0)):this.exitLabel.hidden=!0,this.range.textContent=isFinite(t)?Math.round(t)+" m":"";let i=(this.yaw*180/Math.PI%360+360)%360;this.compass.style.setProperty("--shift",-i*1.45+"px")}destroy(){this.stopped=!0,cancelAnimationFrame(this.raf),this.observer.disconnect(),this.clear(),this.renderer.domElement.removeEventListener("webglcontextlost",this.lost),this.foes.forEach(e=>e.actor.dispose()),this.player?.dispose(),this.labels.replaceChildren(),this.atmo.dispose(),rh(this.scene),this.streakShape.dispose(),this.shotMat.dispose(),this.enemyMat.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),this.renderer.domElement.remove()}};var ne=Ms(vl(),1),TC={views:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("path",{d:"M3 7h5l2-3h4l2 3h5v13H3z"}),(0,ne.jsx)("circle",{cx:"12",cy:"13",r:"3.6"})]}),jump:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("path",{d:"m5 17 5-5 4 2 3-6m-4 0h4v4M4 21h16"}),(0,ne.jsx)("circle",{cx:"11",cy:"6",r:"2"})]}),shield:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("path",{d:"m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z"}),(0,ne.jsx)("path",{d:"M12 7v9m-4.5-4.5h9"})]}),ship:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"m2 15 5 4h11l4-7-7 1H2zM6 13V8h9v5M8 8V4h3v4m5 4V5m0 1 4 4M2 22q3-2 6 0 3-2 6 0 3-2 7 0"})}),plane:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"m2 13 8-2 2-8 2-1 1 9 6 4v2l-7-2-1 5 2 2-4-1-3 1 2-3v-4l-8-.5z"})}),hill:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"m1 17 6-9 4 5 5-9 7 13M4 21v-5l5-4 5 4v5M2 21h19m-5-1v-5l4-3 3 3m-15 6v-3h3v3"})}),train:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("rect",{x:"5",y:"3",width:"14",height:"15",rx:"3"}),(0,ne.jsx)("path",{d:"M5 11h14M8 6h8M7 18l-4 4m14-4 4 4M5 21h14"}),(0,ne.jsx)("circle",{cx:"8.5",cy:"15",r:".8"}),(0,ne.jsx)("circle",{cx:"15.5",cy:"15",r:".8"})]}),brand:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("path",{d:"m12 1 10 6v10l-10 6-10-6V7z"}),(0,ne.jsx)("path",{d:"m12 5 6 3.5v7L12 19l-6-3.5v-7z"}),(0,ne.jsx)("path",{d:"m12 1 0 7m10-1-6.1 3.5M22 17l-6-3.5M12 23v-7M2 17l6.1-3.5M2 7l6.1 3.5"}),(0,ne.jsx)("circle",{cx:"12",cy:"12",r:"2.5"})]}),stages:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"})}),sound:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"M3 9h4l5-4v14l-5-4H3zM16 8c2.1 2.1 2.1 5.9 0 8m3-11c4 4 4 10 0 14"})}),mute:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"})}),pause:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{fill:"currentColor",stroke:"none",d:"M6 4h4v16H6zm8 0h4v16h-4z"})}),coin:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("circle",{cx:"12",cy:"12",r:"9"}),(0,ne.jsx)("path",{d:"m12 6 4.5 6-4.5 6-4.5-6z"})]}),target:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("circle",{cx:"12",cy:"12",r:"7.1"}),(0,ne.jsx)("circle",{cx:"12",cy:"12",r:"2.1"}),(0,ne.jsx)("path",{d:"M12 1v5m0 12v5M1 12h5m12 0h5"})]}),shoot:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("path",{d:"M8.5 3.2H5.2l-2 2v3.3m12.3-5.3h3.3l2 2v3.3M3.2 15.5v3.3l2 2h3.3m7 0h3.3l2-2v-3.3"}),(0,ne.jsx)("circle",{cx:"12",cy:"12",r:"4.1"}),(0,ne.jsx)("circle",{cx:"12",cy:"12",r:".85",fill:"currentColor"})]}),reload:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"M20.2 10a8.5 8.5 0 0 0-14.7-3L3 10m0-6v6h6m-5 4a8.5 8.5 0 0 0 14.6 3l2.4-3m0 6v-6h-6"})}),close:(0,ne.jsx)("path",{d:"m5 5 14 14M19 5 5 19"}),play:(0,ne.jsx)("path",{d:"M7 4.5 20 12 7 19.5z",fill:"currentColor",stroke:"none"}),mouse:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("rect",{x:"6",y:"2",width:"12",height:"20",rx:"6"}),(0,ne.jsx)("path",{d:"M12 3v6"})]}),touch:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("path",{d:"M9 13V6a1.6 1.6 0 0 1 3.2 0v5-1a1.4 1.4 0 0 1 2.7 0v1a1.4 1.4 0 0 1 2.7 0v.7a1.4 1.4 0 0 1 2.7 0v3.7c0 2.6-.9 4.6-2.8 6H11l-4.8-6c-1.5-2 .4-3.4 1.7-2.4L9 14"}),(0,ne.jsx)("path",{d:"m2 6 2-2m-2 2 2 2m-2-2h4"})]}),check:(0,ne.jsx)("path",{d:"m4 12 5 5L20 6"}),menu:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"M4 5h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h5v5h-5z"})}),film:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("rect",{x:"3",y:"4",width:"18",height:"16",rx:"2"}),(0,ne.jsx)("path",{d:"M7 4v16m10-16v16M3 8h4m-4 8h4m10-8h4m-4 8h4"})]}),wind:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"M2 10h12a3 3 0 1 0-3-3m-9 7h15a3 3 0 1 1-3 3"})}),medal:(0,ne.jsxs)(ne.Fragment,{children:[(0,ne.jsx)("circle",{cx:"12",cy:"9",r:"6"}),(0,ne.jsx)("path",{d:"m8 14-1 7 5-3 5 3-1-7"})]}),trophy:(0,ne.jsx)(ne.Fragment,{children:(0,ne.jsx)("path",{d:"M7 3h10v6c0 4-2 6-5 6s-5-2-5-6zM7 5H3v2c0 4 2 5 5 5m9-7h4v2c0 4-2 5-5 5m-4 3v5m-5 1h10"})})};function Bt({name:n,size:e=20}){return(0,ne.jsx)("svg",{"aria-hidden":"true",width:e,height:e,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.65",strokeLinecap:"round",strokeLinejoin:"round",children:TC[n]})}var Bm=[{id:"harbor",name:"Porti i vjet\xEBr",info:"Kalata e anijeve",symbol:"ship",sky:[2308938,10333865,14468260],sun:16768945,sunDirection:[-31,36,-42],haze:11055531,ground:6644055,weather:"rain"},{id:"airfield",name:"Aerodromi",info:"Pista e vjet\xEBr",symbol:"plane",sky:[3693693,11781323,14930873],sun:16770493,sunDirection:[-32,42,-25],haze:12042682,ground:7761238,weather:"clear"},{id:"valley",name:"Lugina e art\xEB",info:"Rruga e fshatit",symbol:"hill",sky:[4351613,13551532,15911569],sun:16764556,sunDirection:[-32,31,-49],haze:13154457,ground:8942684,weather:"clear"},{id:"alpine",name:"Treni alpin",info:"Stacioni malor",symbol:"train",sky:[3234425,12374239,15195600],sun:16770768,sunDirection:[-48,59,-18],haze:11781840,ground:10661559,weather:"snow"}],Wo=n=>String(n).padStart(2,"0");function uh(n,e){try{return JSON.parse(localStorage.getItem("optika3d-"+n)||"null")??e}catch{return e}}function Vm(n,e){try{localStorage.setItem("optika3d-"+n,JSON.stringify(e))}catch{}}var hh=class{constructor(){Z(this,"enabled",!0);Z(this,"ctx",null)}wake(){if(this.enabled)try{this.ctx??(this.ctx=new AudioContext),this.ctx.state==="suspended"&&this.ctx.resume().catch(()=>{})}catch{}}play(e){if(!this.enabled)return;this.wake();let t=this.ctx;if(!t)return;let i=(r,s,o,a,l=0,c="sine")=>{let u=t.createOscillator(),h=t.createGain(),d=t.currentTime+l;u.type=c,u.frequency.setValueAtTime(r,d),u.frequency.exponentialRampToValueAtTime(s,d+o),h.gain.setValueAtTime(1e-4,d),h.gain.exponentialRampToValueAtTime(a,d+.007),h.gain.exponentialRampToValueAtTime(1e-4,d+o),u.connect(h).connect(t.destination),u.start(d),u.stop(d+o+.015),u.onended=()=>{u.disconnect(),h.disconnect()}};(e==="hit"||e==="miss")&&(i(115,38,.17,.16,0,"triangle"),i(680,95,.07,.055,0,"sawtooth"),e==="hit"&&(i(1125,920,.48,.085,.075),i(1720,1320,.24,.04,.085))),e==="load"&&(i(260,370,.08,.055,0,"triangle"),i(450,220,.08,.07,.21,"triangle")),e==="zoom"&&i(310,380,.09,.036,0,"sine"),e==="finish"&&[420,555,695,835].forEach((r,s)=>i(r,r*1.01,.39,.04,s*.11))}close(){this.ctx&&this.ctx.close().catch(()=>{})}};var V=Ms(vl(),1),$x={ammo:7,hp:100,hits:0,shots:0,total:3,score:0,phase:"hunt",scope:!1,mode:"third",reloading:!1};function AC(){let[n,e]=(0,Qe.useState)(0),[t,i]=(0,Qe.useState)(0),[r,s]=(0,Qe.useState)("game"),[o,a]=(0,Qe.useState)($x),[l,c]=(0,Qe.useState)(0),[u,h]=(0,Qe.useState)("Po ngarkohet ambienti 3D\u2026"),[d,p]=(0,Qe.useState)(!1),[v,_]=(0,Qe.useState)(""),[m,f]=(0,Qe.useState)(""),[g,y]=(0,Qe.useState)(()=>uh("sound",!0)),[x,R]=(0,Qe.useState)(()=>uh("records",{})),[T,b]=(0,Qe.useState)(!0),C=(0,Qe.useRef)(null),E=(0,Qe.useRef)(null),M=(0,Qe.useRef)(null),L=(0,Qe.useRef)(null),U=(0,Qe.useRef)(null),I=(0,Qe.useRef)(null),H=(0,Qe.useRef)(null),Y=(0,Qe.useRef)(null),q=(0,Qe.useRef)("game"),te=(0,Qe.useRef)("game"),k=(0,Qe.useRef)(),$=(0,Qe.useRef)(null),Q=(0,Qe.useRef)(null),le=(0,Qe.useRef)({key:(w,S)=>{},visibility:()=>{}}),be=Bm[n];function Te(){Q.current=null,H.current?.stick(0,0),U.current&&(U.current.style.transform="translate(-50%,-50%)")}function X(w){q.current=w,s(w),H.current&&(H.current.paused=w!=="game",H.current.clear()),$.current=null,Te()}function re(){!d||q.current!=="game"||X("pause")}function pe(){X(q.current==="missions"?te.current:"game")}function oe(){te.current=q.current,X("missions")}function Pe(w){X("game"),H.current&&(H.current.paused=!0),e(w),i(S=>S+1),p(!1),a($x),b(!0),f("")}function ke(w){f(w),clearTimeout(k.current),k.current=setTimeout(()=>f(""),1600)}function F(){let w=!g;y(w),Vm("sound",w),Y.current&&(Y.current.enabled=w,w&&Y.current.play("zoom"))}function $e(){return d&&!v&&q.current==="game"}function ve(w){!$e()||!H.current||(Y.current?.wake(),b(!1),w(H.current))}(0,Qe.useEffect)(()=>{Y.current=new hh,Y.current.enabled=g;let w=J=>le.current.key(J,!0),S=J=>le.current.key(J,!1),D=()=>{document.hidden&&le.current.visibility()},G=()=>{H.current?.clear(),Te(),$.current=null};return window.addEventListener("keydown",w),window.addEventListener("keyup",S),window.addEventListener("blur",G),document.addEventListener("visibilitychange",D),()=>{window.removeEventListener("keydown",w),window.removeEventListener("keyup",S),window.removeEventListener("blur",G),document.removeEventListener("visibilitychange",D),Y.current?.close(),clearTimeout(k.current)}},[]),(0,Qe.useEffect)(()=>{p(!1),_(""),c(0),h("Po ngarkohet ambienti 3D\u2026");let w=!0,S;try{S=new lh(C.current,E.current,M.current,L.current,be,{stats(D){if(w&&(a(D),D.phase==="won"||D.phase==="lost")){if(D.phase==="won"){let G=uh("records",{});G[be.id]=Math.max(G[be.id]||0,D.score),Vm("records",G),R(G)}X("end")}},loading(D,G){w&&(h(D),c(G))},ready(){w&&p(!0)},error(D){w&&_(D)},notice:ke,sound:D=>Y.current?.play(D)}),H.current=S,S.paused=q.current!=="game"}catch{_("WebGL nuk u hap n\xEB k\xEBt\xEB shfletues. Provo p\xEBrs\xEBri ose hape loj\xEBn n\xEB Chrome apo Safari.")}return()=>{w=!1,S?.destroy(),H.current=null,clearTimeout(k.current)}},[n,t]),(0,Qe.useEffect)(()=>{r!=="game"&&I.current?.querySelector("button")?.focus({preventScroll:!0})},[r]),le.current.visibility=()=>{d&&q.current==="game"&&re()},le.current.key=(w,S)=>{if(w.ctrlKey||w.metaKey||w.altKey)return;let D=w.key.length===1?w.key.toLowerCase():w.key;if(D==="Escape"&&S&&!w.repeat){q.current==="game"?re():q.current!=="end"&&pe();return}if($e()){if(["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Shift"].includes(D)){w.preventDefault(),H.current?.key(D,S),S&&b(!1);return}if(!(!S||w.repeat))if(D===" "){if(w.target.closest("button"))return;w.preventDefault(),ve(G=>G.shoot())}else D==="r"?ve(G=>G.reload()):D==="z"?ve(G=>G.scope()):D==="v"?ve(G=>G.toggleCamera()):D==="j"&&ve(G=>G.jump())}};let Je=w=>{!$e()||$.current||w.button!==0||(Y.current?.wake(),w.currentTarget.focus({preventScroll:!0}),w.currentTarget.setPointerCapture(w.pointerId),$.current={id:w.pointerId,x:w.clientX,y:w.clientY,travel:0})},_e=w=>{let S=$.current;if(!S||S.id!==w.pointerId)return;let D=w.clientX-S.x,G=w.clientY-S.y;S.travel+=Math.hypot(D,G),S.travel>3&&(H.current?.drag(D,G),b(!1)),S.x=w.clientX,S.y=w.clientY},ye=w=>{let S=$.current;if(!S||S.id!==w.pointerId||($.current=null,S.travel>6))return;let D=w.currentTarget.getBoundingClientRect();ve(G=>G.shoot(new Le((w.clientX-D.left)/D.width*2-1,1-(w.clientY-D.top)/D.height*2)))},Oe=w=>{if(Q.current!==w.pointerId)return;let S=w.currentTarget.getBoundingClientRect(),D=S.width*.36,G=(w.clientX-S.left-S.width/2)/D,J=(w.clientY-S.top-S.height/2)/D,ee=Math.max(1,Math.hypot(G,J));G/=ee,J/=ee,H.current?.stick(G,J),U.current&&(U.current.style.transform="translate(calc(-50% + "+G*D+"px),calc(-50% + "+J*D+"px))")},Xe=w=>{!$e()||Q.current!==null||(w.preventDefault(),w.currentTarget.setPointerCapture(w.pointerId),Q.current=w.pointerId,Y.current?.wake(),b(!1),Oe(w))},ut=o.phase==="extract"?"Arrij te dalja":"Mposht patrull\xEBn";return(0,V.jsxs)("main",{className:"game "+(o.scope?"scoped ":"")+(o.mode==="first"?"first ":"")+(d?"ready ":"")+(r==="game"?"":"covered"),"aria-label":"Optika, loj\xEB 3D",children:[(0,V.jsx)("div",{className:"world",ref:C}),(0,V.jsx)("div",{className:"edges"}),(0,V.jsx)("div",{className:"scope-glass"}),(0,V.jsx)("div",{className:"markers",ref:E}),(0,V.jsxs)("div",{className:"cross",children:[(0,V.jsx)("i",{}),(0,V.jsx)("b",{})]}),(0,V.jsx)("div",{className:"look",role:"application",tabIndex:r==="game"?0:-1,"aria-label":"Bota e loj\xEBs. Rr\xEBshqit p\xEBr t\xEB kthyer kamer\xEBn. W A S D p\xEBr t\xEB ecur.",onPointerDown:Je,onPointerMove:_e,onPointerUp:ye,onLostPointerCapture:w=>{$.current?.id===w.pointerId&&($.current=null)}}),(0,V.jsxs)("div",{className:"hud",ref:w=>{w&&(w.inert=r!=="game"||!d)},children:[(0,V.jsxs)("header",{className:"bar",children:[(0,V.jsxs)("div",{className:"brand",children:[(0,V.jsx)(Bt,{name:"brand",size:30}),(0,V.jsx)("strong",{children:"OPTIKA"})]}),(0,V.jsxs)("div",{className:"top-right",children:[(0,V.jsxs)("span",{className:"score","aria-label":o.score+" pik\xEB",children:[(0,V.jsx)(Bt,{name:"coin",size:17}),o.score]}),(0,V.jsxs)("button",{className:"headbtn",onClick:oe,"aria-label":"Zgjidh misionin",title:"Misionet",children:[(0,V.jsx)(Bt,{name:"stages",size:19}),(0,V.jsx)("span",{children:"Misionet"})]}),(0,V.jsxs)("button",{className:"headbtn camera",onClick:()=>ve(w=>w.toggleCamera()),"aria-label":o.mode==="third"?"Shiko nga syt\xEB e lojtarit":"Shiko pas lojtarit",title:"Nd\xEBrro kamer\xEBn (V)",children:[(0,V.jsx)(Bt,{name:"views",size:17}),(0,V.jsx)("span",{children:o.mode==="third"?"3P":"1P"})]}),(0,V.jsx)("button",{className:"headbtn pause",onClick:re,"aria-label":"Pauz\xEB",children:(0,V.jsx)(Bt,{name:"pause",size:16})})]})]}),(0,V.jsxs)("div",{className:"compass","aria-hidden":"true",children:[(0,V.jsx)("div",{ref:M,className:"compass-strip",children:Array.from({length:3},(w,S)=>(0,V.jsx)(Qe.default.Fragment,{children:["V","VL","L","JL","J","JP","P","VP"].map(D=>(0,V.jsx)("span",{children:D},D))},S))}),(0,V.jsx)("b",{})]}),(0,V.jsxs)("section",{className:"mission",children:[(0,V.jsxs)("div",{className:"kicker",children:[(0,V.jsx)("i",{})," MISIONI ",Wo(n+1)," ",(0,V.jsx)("em",{children:"/ 04"})]}),(0,V.jsx)("h1",{children:be.name}),(0,V.jsxs)("div",{className:"objective",children:[(0,V.jsx)("i",{className:o.phase==="extract"?"safe":""}),(0,V.jsx)("span",{children:ut}),(0,V.jsx)("b",{children:o.phase==="extract"?"":o.hits+" / "+o.total})]})]}),(0,V.jsxs)("div",{className:"distance",children:[(0,V.jsx)(Bt,{name:"target",size:12}),(0,V.jsx)("span",{ref:L})]}),(0,V.jsx)("div",{className:"notice",role:"status",children:m&&(0,V.jsx)("span",{children:m},m)}),(0,V.jsxs)("div",{className:"foot-hud",children:[(0,V.jsxs)("div",{className:"movement",children:[(0,V.jsxs)("div",{className:"joystick",role:"group","aria-label":"Lev\xEB l\xEBvizjeje",onPointerDown:Xe,onPointerMove:Oe,onPointerUp:Te,onPointerCancel:Te,onLostPointerCapture:w=>{Q.current===w.pointerId&&Te()},children:[(0,V.jsx)("i",{}),(0,V.jsx)("b",{}),(0,V.jsx)("span",{ref:U})]}),(0,V.jsx)("small",{children:"L\xCBVIZ"})]}),(0,V.jsxs)("div",{className:"actions",children:[(0,V.jsx)("button",{className:"mini jump",onClick:()=>ve(w=>w.jump()),"aria-label":"K\xEBrce",title:"K\xEBrce (J)",children:(0,V.jsx)(Bt,{name:"jump",size:20})}),(0,V.jsxs)("div",{className:"pair",children:[(0,V.jsxs)("button",{className:"action zoom "+(o.scope?"on":""),onClick:()=>ve(w=>w.scope()),"aria-label":o.scope?"Hiq zmadhimin":"Zmadho","aria-pressed":o.scope,children:[(0,V.jsx)("span",{children:(0,V.jsx)(Bt,{name:"target",size:24})}),(0,V.jsx)("small",{children:o.scope?"1\xD7 PAMJE":"ZMADHO"})]}),(0,V.jsxs)("button",{className:"action fire",onClick:()=>ve(w=>w.shoot()),disabled:o.reloading||o.phase==="extract","aria-label":o.ammo?"Q\xEBllo":"Rimbush municionin",children:[(0,V.jsx)("span",{children:(0,V.jsx)(Bt,{name:o.ammo?"shoot":"reload",size:32})}),(0,V.jsx)("small",{children:o.ammo?"Q\xCBLLO":"RIMBUSH"})]})]})]})]}),(0,V.jsxs)("footer",{children:[(0,V.jsxs)("div",{className:"health","aria-label":"Energji "+o.hp,children:[(0,V.jsx)(Bt,{name:"shield",size:16}),(0,V.jsx)("b",{children:o.hp}),(0,V.jsx)("div",{children:(0,V.jsx)("i",{style:{width:o.hp+"%"}})})]}),(0,V.jsx)("p",{className:"hint",children:T?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)("span",{className:"phone",children:"Rr\xEBshqit p\xEBr t\xEB par\xEB rreth e rrotull"}),(0,V.jsx)("span",{className:"desk",children:"W A S D p\xEBr t\xEB ecur \xB7 T\xEBrhiq p\xEBr t\xEB par\xEB"})]}):be.info}),(0,V.jsxs)("button",{className:"ammo",disabled:o.reloading||o.ammo===7||o.phase==="extract","aria-label":"Rimbush",title:"Rimbush (R)",onClick:()=>ve(w=>w.reload()),children:[(0,V.jsx)(Bt,{name:"reload",size:15}),(0,V.jsx)("b",{children:o.reloading?"\u2026":Wo(o.ammo)}),(0,V.jsx)("small",{children:"/ \u221E"})]})]})]}),(!d||v)&&(0,V.jsx)("div",{className:"loader",children:(0,V.jsxs)("div",{children:[(0,V.jsxs)("div",{className:"load-brand",children:[(0,V.jsx)(Bt,{name:"brand",size:34}),(0,V.jsx)("b",{children:"OPTIKA"})]}),(0,V.jsxs)("div",{className:"kicker",children:["MISIONI ",Wo(n+1)," / 04"]}),(0,V.jsx)("h2",{children:be.name}),(0,V.jsx)("p",{children:v||u}),v?(0,V.jsx)("button",{className:"primary",onClick:()=>Pe(n),children:"Provo s\xEBrish"}):(0,V.jsx)("div",{className:"load-line",children:(0,V.jsx)("i",{style:{width:Math.max(l,3)+"%"}})})]})}),r!=="game"&&(0,V.jsx)("div",{className:"curtain",children:(0,V.jsxs)("section",{role:"dialog","aria-modal":"true","aria-labelledby":"title",className:"dialog "+(r==="missions"?"library":""),ref:I,onKeyDown:w=>{if(w.key!=="Tab")return;let S=Array.from(w.currentTarget.querySelectorAll("button"));S.length&&(w.shiftKey&&document.activeElement===S[0]?(w.preventDefault(),S.at(-1)?.focus()):!w.shiftKey&&document.activeElement===S.at(-1)&&(w.preventDefault(),S[0].focus()))},children:[(0,V.jsxs)("div",{className:"dialog-head",children:[(0,V.jsxs)("div",{className:"kicker",children:[(0,V.jsx)("i",{})," ",r==="missions"?"FUSHATA":"MISIONI "+Wo(n+1)+" / 04"]}),r!=="end"&&(0,V.jsx)("button",{className:"headbtn","aria-label":"Mbyll",onClick:pe,children:(0,V.jsx)(Bt,{name:"close",size:16})})]}),r==="missions"?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)("h2",{id:"title",children:"Zgjidh misionin"}),(0,V.jsx)("div",{className:"maps",children:Bm.map((w,S)=>(0,V.jsxs)("button",{onClick:()=>S===n&&te.current!=="end"?X("game"):Pe(S),children:[(0,V.jsx)(Bt,{name:w.symbol,size:31}),(0,V.jsxs)("span",{children:[(0,V.jsxs)("small",{children:["MISIONI ",Wo(S+1)]}),(0,V.jsx)("b",{children:w.name})]}),(0,V.jsx)("em",{children:x[w.id]?x[w.id]+" pik\xEB":S===n?"Aktiv":""})]},w.id))})]}):r==="pause"?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)("h2",{id:"title",children:"N\xEB pauz\xEB"}),(0,V.jsxs)("p",{children:[be.name," \xB7 ",o.hits," / ",o.total," kund\xEBrshtar\xEB"]}),(0,V.jsxs)("button",{className:"primary",onClick:pe,children:[(0,V.jsx)(Bt,{name:"play",size:16})," Vazhdo loj\xEBn"]}),(0,V.jsxs)("div",{className:"sub-actions",children:[(0,V.jsxs)("button",{onClick:()=>Pe(n),children:[(0,V.jsx)(Bt,{name:"reload",size:16})," Nga fillimi"]}),(0,V.jsxs)("button",{onClick:oe,children:[(0,V.jsx)(Bt,{name:"stages",size:16})," Misionet"]})]}),(0,V.jsxs)("div",{className:"setting",children:[(0,V.jsx)("span",{children:"Z\xEBri"}),(0,V.jsxs)("button",{"aria-label":g?"Fik z\xEBrin":"Ndiz z\xEBrin",onClick:F,children:[(0,V.jsx)(Bt,{name:g?"sound":"mute",size:17}),g?"Aktiv":"Fikur"]})]}),(0,V.jsx)("p",{className:"help",children:"L\xEBviz me lev\xEBn majtas. Rr\xEBshqit n\xEB an\xEBn e djatht\xEB t\xEB ekranit p\xEBr t\xEB kthyer kamer\xEBn. Prek nj\xEB kund\xEBrshtar ose p\xEBrdor butonin Q\xEBllo."})]}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)("h2",{id:"title",children:o.phase==="won"?"Misioni u p\xEBrfundua":"Misioni p\xEBrfundoi"}),(0,V.jsx)("p",{children:be.name}),(0,V.jsxs)("div",{className:"results",children:[(0,V.jsxs)("span",{children:[(0,V.jsx)("small",{children:"Pik\xEB"}),(0,V.jsx)("b",{children:o.score})]}),(0,V.jsxs)("span",{children:[(0,V.jsx)("small",{children:"Sakt\xEBsia"}),(0,V.jsxs)("b",{children:[o.shots?Math.round(o.hits/o.shots*100):0,"%"]})]}),(0,V.jsxs)("span",{children:[(0,V.jsx)("small",{children:"Patrulla"}),(0,V.jsxs)("b",{children:[o.hits,"/",o.total]})]})]}),(0,V.jsx)("button",{className:"primary",onClick:()=>o.phase==="won"?n<3?Pe(n+1):oe():Pe(n),children:o.phase==="won"?n<3?"Misioni tjet\xEBr":"Zgjidh misionin":"Provo s\xEBrish"}),(0,V.jsx)("button",{className:"replay",onClick:()=>o.phase==="won"?Pe(n):oe(),children:o.phase==="won"?"Luaj p\xEBrs\xEBri":"Misionet"})]})]})})]})}(0,Jx.createRoot)(document.getElementById("root")).render((0,V.jsx)(AC,{}));})();
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.production.min.js:
  (**
   * @license React
   * scheduler.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.production.min.js:
  (**
   * @license React
   * react-dom.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.min.js:
  (**
   * @license React
   * react-jsx-runtime.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2024 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
