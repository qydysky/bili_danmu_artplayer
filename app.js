import Artplayer from 'artplayer';
import mpegts from 'mpegts.js';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';

import ploading from "./img/ploading.gif";
import state from "./img/state.png";
import indicator from "./img/indicator.svg";
import filp from "./img/filp.svg";
import saveSvg from "./img/save.svg";
import ok from "./img/ok.svg";
import http from "stream-http";
import MD5 from "crypto-js/md5";

(() => {
    class FIFO {
        #indexedDB;
        #ok=false;
        #db;
        #size=0;
        #cu=1;
        #dbN="FIFO"+new Date().getTime();
        #objN="fifo"+new Date().getTime();

        constructor(okf = (_)=>{}) {
            const that = this;
            this.#indexedDB = window.indexedDB;
            if (!this.#indexedDB) {
                console.error("IndexedDB could not be found in this browser.");
            }

            this.close().catch();

            const request = this.#indexedDB.open(this.#dbN, 1);

            request.onerror = function (event) {
                console.error("An error occurred with IndexedDB");
                console.error(event);
            };
            
            request.onupgradeneeded = function () {
                that.#db = request.result;
                that.#db.createObjectStore(that.#objN, { keyPath: "id", autoIncrement: true });
            };
            
            request.onsuccess = function () {
                console.log("Database opened successfully");
                that.#db = request.result;
                that.#ok = true;
                if(okf)okf(that);
            };
        }

        #getTx(mode,func) {
            if(!this.#ok)return;
            const transaction = this.#db.transaction(this.#objN, mode);
            transaction.onerror = (event) => {
                console.error("An error occurred with put");
                console.error(event);
            };
            transaction.oncomplete = function () {};
            return func(transaction, transaction.objectStore(this.#objN));
        }

        #stillTx(transaction,func) {
            return func(transaction, transaction.objectStore(this.#objN));
        }

        size(){
            return new Promise((resolve) => resolve(this.#size));
        }

        showSize(){
            return this.#getTx("readonly",  (transaction, store)=>{
                const idQuery = store.count();
                idQuery.onsuccess = function () {
                    console.log(this.#size);
                };
            });
        }

        put(data){
            const that = this;
            return this.#getTx("readwrite",  (transaction, store)=>{
                return new Promise((resolve) => {
                    store.put({ data: data });
                    that.#size += 1;
                    resolve(that.#size);
                });
            });
        }

        get(){
            const that = this;
            return this.#getTx("readwrite", (transaction, store)=>{
                return new Promise((resolve, reject) => {
                    const idQuery = store.get(that.#cu);
                    idQuery.onsuccess = async function () {
                        if(idQuery.result){
                            that.#size -= 1;
                            that.#cu += 1;
                            await that.#stillTx(transaction,  (transaction, store)=>{
                                return new Promise((resolve) => {
                                    transaction.oncomplete = function () {
                                        resolve();
                                    };
                                    store.delete(idQuery.result.id)
                                });
                            });
                            resolve({size: that.#size, data: idQuery.result.data});
                        } else reject();
                    };
                });
            });
        }

        /**
         * @returns .then(e=>{}).catch(e=>{});
         */
        close(){
            if(this.#ok)this.#db.close();
            return new Promise((resolve, reject) => {
                const DBDeleteRequest = this.#indexedDB.deleteDatabase(this.#dbN);
                DBDeleteRequest.onerror = (event) => {
                    reject("Error deleting database.");
                };

                DBDeleteRequest.onsuccess = (event) => {
                    if(event.result===undefined)resolve("Database deleted successfully.");
                    else reject("Error deleting fail.");
                };
            });
        }

        deleteOnExit() {
            let that = this;
            window.addEventListener('beforeunload', function (e) {
                that.close().catch(()=>{});
            });
        }

        static test() {
            new FIFO(async fifo=>{
                fifo.put(1).then(size=>size!=1?console.error("size:1 ",size):console.log("1ok"));
                fifo.put(2).then(size=>size!=2?console.error("size:2 ",size):console.log("2ok"));
                fifo.put(3).then(size=>size!=3?console.error("size:3 ",size):console.log("3ok"));
                fifo.put(4).then(size=>size!=4?console.error("size:4 ",size):console.log("4ok"));
                fifo.size().then(size=>size!=4?console.error("size:4 ",size):console.log("5ok"));
                console.log('1!')
                await fifo.get().then(result=>result.id!=1?console.error(result):console.log("6ok")).catch(()=>{});
                console.log('2!')
                await fifo.get().then(result=>result.id!=2?console.error(result):console.log("7ok")).catch(()=>{});
                console.log('3!')
                fifo.close().then(r=>console.log(r)).catch(result=>console.error(result));
                console.log("fin");
            });
        }
    }

    class EventPromise {
        #eventEL = document.createElement("_");
        
        eventCall(name, data = undefined, el = this.#eventEL){
            let e = new Event(name, {bubbles: true, cancelable: false})
            e.detail = data;
            el.dispatchEvent(e);
        }

        promise(name, bootFunc = ({event: event})=>{}){
            return EventPromise.toPromise(this, name, bootFunc);
        }

        /**
         * cover event listener to promise
         * @param {*} object 
         * @param {*} event name 
         * @param {*} bootFunc {event: event} => {}
         * @returns .then(({event: event, data: data}) => {}).catch(({event: event, error: error}) => {})
         */
        static toPromise(object, name, bootFunc = ({event: event})=>{}){
            return new Promise((resolve, reject) => {
                let event = object.addEventListener(name, data =>{
                    object.removeEventListener(name, event);
                    resolve({object:object, name:name, event: event, data: data});
                });
                try {
                    bootFunc({event: event});
                } catch (error) {
                    object.removeEventListener(name, event);
                    reject({object:object, name:name, event: event, error: error});
                }
            });
        }

        addEventListener(name, func, el = this.#eventEL){
            let eventFunc = e=>func(e.detail);
            el.addEventListener(name, eventFunc);
            return eventFunc;
        }

        removeEventListener(name, eventFunc, el = this.#eventEL){
            el.addEventListener(name, eventFunc);
        }

        constructor(name){
            this.#eventEL = document.createElement(name);
        }

        static test(){
            let ep = new EventPromise();
            ep.addEventListener("test", data=>{
                if (data=="ss")console.log("event ok");
                else console.error(data);
            });
            ep.promise("test").then(data=>{
                if (data=="ss")console.log("promise ok");
                else console.error(data);
            });
            ep.eventCall('test','ss');
        }
    }

    class MSC extends EventPromise {
        #fetchDone = false;
        #forceExit = false;
        #exit = () => this.#forceExit || this.#bufLen <= 1 && this.#fifoL == 0 && this.#fetchDone;
        #fifo;

        #id = new Date().getTime();
        #url = "";
        #loadedRange = 0;
        #video;
        #fifoL = 0;
        #bufLen = 0;
        #sourceBuffer;
        #mediaSource;
        #abortController = new AbortController();

        #mp4LoadFromDB = 20;
        #mp4StopFromDB = 30;
        #mp4LoadFromWeb = 1000;
        #mp4StopFromWeb = 2000;

        #loopIfFalse(f, miliSec = 1000, rejectFail = false){
            return new Promise((reslove, reject)=>{
                if(f())return reslove();
                let l = () => setTimeout(()=>{
                    if(f())return reslove();
                    else if(rejectFail)return reject();
                    else return l();
                },miliSec);
                l();
            });
        }

        #fetchLoop = () => {
            let that = this;
            var reqHeaders = new Headers();
            reqHeaders.append("Range", "bytes="+that.#loadedRange+"-");

            fetch(new Request(that.#url,{
                method: "GET",
                headers: reqHeaders,
                mode: "cors",
                cache: "default",
                signal: this.#abortController.signal,
            }))
            .then((response) => {
                const reader = response.body.getReader();
                reader.read().then(function pump({ done, value }) {
                    if(done)return that.eventCall("fetch.done", "ok");
                    if(that.#exit())return;
                    
                    that.#loadedRange += value.length;
                    that.#fifo.put(value).then(tfifoL=>{that.#fifoL = tfifoL;});

                    if(that.#fifoL>that.#mp4StopFromWeb){
                        reader.cancel();
                        return that.#loopIfFalse(()=>that.#exit() || that.#fifoL<that.#mp4LoadFromWeb).then(()=>that.#fetchLoop());
                    }
                    return reader.read().then(pump);
                });
            })
            .catch(({event: event, error: error}) => that.eventCall("error", {altmsg: error}));
        }

        #sourceBufferLoop = () => {
            let that = this;
            let deal = () => {

                if(that.#mediaSource.sourceBuffers.length != 0 && that.#sourceBuffer.buffered.length != 0)
                    that.#bufLen = that.#sourceBuffer.buffered.end(that.#sourceBuffer.buffered.length-1) - that.#video.currentTime;
                else that.#bufLen = 0;

                if(that.#exit()){
                    try {
                        that.eventCall("mediaSource.sourceended");
                        that.#mediaSource.endOfStream();
                    } catch {}
                    return;
                }

                if(that.#bufLen<that.#mp4StopFromDB){
                    return that.#fifo.get()
                    .then(({size: size, data: data})=>{
                        that.#fifoL = size;
                        that.#sourceBuffer.appendBuffer(data);
                    })
                    .catch(()=>setTimeout(deal, 1000));
                } else {
                    return that.#loopIfFalse(()=>{
                        if(that.#mediaSource.sourceBuffers.length != 0 && that.#sourceBuffer.buffered.length != 0)
                            that.#bufLen = that.#sourceBuffer.buffered.end(that.#sourceBuffer.buffered.length-1) - that.#video.currentTime;
                        else that.#bufLen = 0;
                        return that.#exit() || that.#bufLen<that.#mp4LoadFromDB;
                    }).then(deal);
                }
            };

            that.#sourceBuffer.addEventListener("updateend", deal);
            
            deal();
        }

        #stateLoop(){
            let that = this;
            setTimeout(()=>{
                if(that.#exit())return;
                console.log("[%s] fifo: %d buf: %d", that.#id, that.#fifoL, that.#bufLen);
                that.#stateLoop();
            }, 2000);
        }

        #watchExit(){
            let exitf = (o) => {
                console.log("MSC Exit");
                this.#forceExit = true;
                this.#abortController.abort();
                this.removeEventListener("mediaSource.sourceended", exitf);
                this.removeEventListener("beforeunload", exitf, window);
                this.removeEventListener("mediaSource.error", exitf);
                this.removeEventListener("error", exitf, this.#video);
                this.removeEventListener("error", exitf, this.#sourceBuffer);
                if(o.event && o.event.name && o.event.name.indexOf("error") != -1)console.error(o);
                else console.log(o);
                if(o.event && o.event.altmsg)alert(o.altmsg);
            }
            this.promise("mediaSource.sourceended").then(exitf).catch(()=>{});
            this.promise("mediaSource.error").then(exitf).catch(()=>{});
            EventPromise.toPromise(window, "beforeunload").then(exitf).catch(()=>{});
            EventPromise.toPromise(this.#video, "error").then(exitf).catch(()=>{});
            EventPromise.toPromise(this.#sourceBuffer, "error").then(exitf).catch(()=>{});
        }

        constructor({
            video: video, 
            url: url, 
            mimeType: mimeType = 'video/mp4; codecs="avc1.640032,mp4a.40.2"', 
            mode: mode = "sequence",
            mp4LoadFromDB = 20,
            mp4StopFromDB = 30,
            mp4LoadFromWeb = 1000,
            mp4StopFromWeb = 2000
        }){
            super();

            let that = this;
            that.#url = url;
            that.#video = video;
            that.#mp4LoadFromDB = mp4LoadFromDB;
            that.#mp4StopFromDB = mp4StopFromDB;
            that.#mp4LoadFromWeb = mp4LoadFromWeb;
            that.#mp4StopFromWeb = mp4StopFromWeb;

            if (!MediaSource.isTypeSupported(mimeType)) {
                that.eventCall("mediaSource.error", {altmsg: mimeType+" not Supported"});
                return;
            }

            this.#mediaSource = new MediaSource();
            this.#mediaSource.addEventListener('sourceopen', () => {

                that.eventCall("mediaSource.sourceopen");

                that.#sourceBuffer = that.#mediaSource.addSourceBuffer(mimeType);
                that.#sourceBuffer.mode = mode;

                if(that.#mediaSource.sourceBuffers.length == 0){
                    that.eventCall("mediaSource.error", {altmsg: "addSourceBuffer error"});
                    return;
                }

                this.promise("fetch.done").then(()=>{
                    that.#fetchDone = true;
                    console.log("[%s] fetch.done", that.#id);
                });

                that.#watchExit();

                that.#stateLoop();

                that.#sourceBufferLoop();

                that.#fetchLoop();
            });

            new FIFO(fifo => {
                fifo.deleteOnExit();
                that.#fifo = fifo;
                that.#video.src = URL.createObjectURL(that.#mediaSource);
            });
        }
    }

    console.log("init 31");

    let para = new URL(window.location.href).searchParams;

    let initT = null,
        player,
        flvPlayer,
        disableSave = false,
        config = {
            container: '.artplayer-app',
            url: "../stream?_=" + new Date().getTime()+
            "&ref="+para.get("ref")+
            "&st="+(para.get("st")?para.get("st"):"")+
            "&dur="+(para.get("dur")?para.get("dur"):"")+
            "&modeq="+(para.get("modeq")?para.get("modeq"):""),
            title: "" + new Date().getTime(),
            type: para.get("format")||"flv",
            volume: 0.5,
            hotkey: true,
            isLive: true,
            muted: false,
            autoplay: para.get("ref")=="now",
            autoMini: true,
            screenshot: true,
            setting: true,
            loop: false,
            flip: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: true,
            subtitleOffset: true,
            miniProgressBar: true,
            mutex: true,
            backdrop: true,
            playsInline: true,
            autoPlayback: false,
            theme: '#23ade5',
            lang: navigator.language.toLowerCase(),
            whitelist: ['*'],
            moreVideoAttr: {
                crossOrigin: 'anonymous',
            },
            settings: [],
            contextmenu: [],
            layers: [],
            quality: [],
            thumbnails: {},
            subtitle: {},
            highlight: [],
            controls: [
                {
                    tooltip: '翻转',
                    index: 10,
                    position: 'right',
                    html: '<img width="22" heigth="22" src="'+ filp +'">',
                    click: function (...args) {
                        let f = function(...e){
                            // if(e)alert(e);
                            rotate(document.querySelector('.art-video'));
                            rotate(document.querySelector('.art-danmuku'));
                        }, rotate = function(element) {
                            if(element.style.transform == 'rotateZ(0deg)' || element.style.transform == ''){
                                element.style.transform = 'rotateZ(180deg)';
                            }
                            else {
                                element.style.transform = 'rotateZ(0deg)';
                            }
                        };

                        switch (screen.orientation.type) {
                            case "landscape-primary":
                                screen.orientation.lock("landscape-secondary").catch(e=>{f(e);});
                                break;
                            case "landscape-secondary":
                                screen.orientation.lock("landscape-primary").catch(e=>{f(e);});
                                break;
                            case "portrait-secondary":
                                screen.orientation.lock("portrait-primary").catch(e=>{f(e);});
                                break;
                            case "portrait-primary":
                                screen.orientation.lock("portrait-secondary").catch(e=>{f(e);});
                                break;
                            default:
                                f();
                        }
                    },
                },
                {
                    disable: para.get("ref")=="now", 
                    tooltip: '保存进度',
                    index: 11,
                    position: 'right',
                    html: '<img id="save" width="22" heigth="22" src="'+ saveSvg +'">',
                    click: function (...args) {
                        if(disableSave)return;
                        disableSave = true;
                        let para = new URL(window.location.href).searchParams;
                        let sref = para.get("ref")?para.get("ref"):""
                        let ref = sref.split("/").slice(0,-1).join("/")
                        ref = ref?ref+"/":""

                        let save = localStorage.getItem("save")
                        save = save?JSON.parse(save):{}

                        save[ref] = {}
                        
                        let st = para.get("st")?para.get("st"):""
                        if(st)st=st.replace("m","")
                        st = Number(st)*60+((player.currentTime?player.currentTime:0)-(initT?initT:0))
                    
                        let dur = para.get("dur")?para.get("dur"):""
                        if(dur){
                            dur=dur.replace("m","")
                            dur = Number(dur)*60-((player.currentTime?player.currentTime:0)-(initT?initT:0))
                            dur = dur<30?30:dur
                            save[ref].dur = (dur/60).toFixed(1)+"m"
                        }

                        save[ref].ref = sref
                        save[ref].st = (st/60).toFixed(1)+"m"
                        save[ref].format = (para.get("format")?para.get("format"):"")
                        localStorage.setItem("save",JSON.stringify(save))
                        document.querySelector('#save').src = ok
                        setTimeout(()=>{
                            history.replaceState({ page: 3 }, "title 3", "?ref="+sref+"&format="+save[ref].format+"&st="+save[ref].st+(dur?"&dur="+dur:""));
                            document.querySelector('#save').src = saveSvg
                            disableSave = false;
                        },500)
                    },
                },
            ],
            plugins: [
                artplayerPluginDanmuku({
                    danmuku: [],
                    speed: 10,
                    fontSize: "4%",
                    emitter: document.body.clientWidth>800,
                    opacity: 0.7,
                    ...JSON.parse(localStorage.getItem('danmuku') || '{}'),
                }),
            ],
            icons: {
                loading: '<img src=' + ploading + '>',
                state: '<img width="150" heigth="150" src=' + state + '>',
                indicator: '<img width="16" heigth="16" src=' + indicator + '>',
            },
            customType: {
                mp4: (video, url) => {
                    if(url.indexOf("now")!=-1)new MSC({video: video, url: url});
                    else video.src = url;
                },
                flv: function (video, url) {
                    var needUnload = true;
                    if(flvPlayer){
                        needUnload = false;
                        flvPlayer.destroy();
                    }
                    if (mpegts.getFeatureList().mseLivePlayback) {
                        flvPlayer = mpegts.createPlayer({
                            type: 'flv',  // could also be mpegts, m2ts, flv
                            isLive: true,
                            url: url
                        });
                        flvPlayer.attachMediaElement(video);
                        flvPlayer.load();
                        flvPlayer.on("error", function(){
                            flvPlayer.destroy();
                            var c = config;
                            c.type="mp4";
                            initPlay(c);
                        })
                        if(needUnload){
                            setTimeout(function(){
                                if(flvPlayer.paused)flvPlayer.unload();
                            },1000);
                        }
                    }
                },
            },
        };
    
    /**
     * ws 收发
     */
     function ws(player) {
        let st = new URL(window.location.href).searchParams.get("st")
        let ref = new URL(window.location.href).searchParams.get("ref")
        if(st)st=st.replace("m","")
        if (window["WebSocket"]) {
            let conn = new WebSocket("ws://" + window.location.host + window.location.pathname+"ws?ref="+ref);
            let paused = true;

            conn.onmessage = function (evt) {
                try {
                    let data = JSON.parse(evt.data)
                    player.plugins.artplayerPluginDanmuku.emit({
                        text: data.text,
                        color: data.style.color,
                        border: data.style.border,
                        mode: data.style.mode,
                    });
                } catch (e) {
                    console.log(e)
                    console.log(evt.data)
                }
            };
            conn.onopen = function () {
                conn.send(`pause`)

                let play = (event) => {
                    paused = false;
                    if(initT==null)initT = player.currentTime;

                    if(conn && player)conn.send(Number(st)*60+(player.currentTime-initT))
                    if(conn != undefined)conn.send(`play`);
                };

                let pause = (...args) => {
                    paused = true;
                    
                    player.plugins.artplayerPluginDanmuku.config({
                        danmuku: [],
                        speed: 10,
                        emitter: document.body.clientWidth>800,
                        fontSize: "4%",
                        opacity: 0.7,
                        ...JSON.parse(localStorage.getItem('danmuku') || '{}'),
                    });
                    player.plugins.artplayerPluginDanmuku.load();

                    if(conn != undefined)conn.send(`pause`);
                };

                let interval_handle = setInterval(()=>{
                    if(player.playing && paused)play();
                    if(!player.playing && !paused)pause();
                    if(conn && player && (ref == "now" || initT!=null))conn.send(Number(st)*60+(player.currentTime-initT))
                },3000);

                player.on("video:play", play);
                player.on('pause', pause);
                player.on('error', (error, reconnectTime) => {
                    if(error.message==undefined)return;
                    console.log(error.message)
                });
                player.on('ended', (...args) => {
                    console.log('ended')
                    if(conn != undefined)conn.close();
                });
                player.on('artplayerPluginDanmuku:emit', (danmu) => {
                    if(conn != undefined)conn.send("%S"+danmu.text);
                });

                conn.onclose = function (evt) {
                    console.log("close ws")
                    conn = undefined
                    clearInterval(interval_handle)
                };
                conn.onerror = () => {
                    console.log("err ws")
                    conn = undefined
                    clearInterval(interval_handle);
                };
            };
        }
    }

    function initPlay(config) {
        player = new Artplayer(config);
        let wsinit = false;
        player.on('ready', () => {
            player.autoHeight();
            if(!wsinit){
                wsinit = true;
                ws(player);
            }
        });
        player.on('resize', () => {
            player.autoHeight();
        });
        player.on('error', (error, reconnectTime) => {
            if(error.message==undefined)return;
            console.log(error.message);
            window.location.reload();
            // console.log("clear danmu");
            // player.plugins.artplayerPluginDanmuku.config({
            //     danmuku: [],
            //     speed: 10,
            //     emitter: document.body.clientWidth>800,
            //     fontSize: "4%",
            //     opacity: 0.7,
            //     ...JSON.parse(localStorage.getItem('danmuku') || '{}'),
            // });
            // player.plugins.artplayerPluginDanmuku.load();
            // ws(player);
        });
        player.on('video:ended', (...args) => {
            if(flvPlayer)flvPlayer.unload();
        });
        player.on('artplayerPluginDanmuku:config', (option) => {
            // 排除不必要的选项，如mount
            const { mount, ...rest } = option;
            // 保存到localStorage
            localStorage.setItem('danmuku', JSON.stringify(rest));
        });
        player.on('artplayerPluginDanmuku:visible', (danmu) => {
            var array = danmu.$ref.innerText;
            var html = "";
            var emotS = "";
            var emot = false;

            for (let index = 0; index < array.length; index++) {
                const element = array[index];

                emot=(!emot && element=="[") || (emot && element!="]")
                if(emot)emotS+=element=="["?"":element;
                else {
                    if(emotS!=""){
                        html+="<img src=\"../emots/"+MD5("["+emotS+"]").toString()+".png\" onerror=\"this.outerHTML='["+emotS+"]'\" alt=\"["+emotS+"]\" style=\"object-fit: scale-down;height: 1.25em;max-width: unset;\"></img>";
                        emotS="";
                    } 
                    else html+=element;
                }
            }
            danmu.$ref.innerHTML = html;
        });
        document.addEventListener("resize", player.autoSize);
        // window.addEventListener('beforeunload', function (e) {
        //     tabUnload = true;
        // });
        console.log("initPlayer")
    }

    http.get('../keepAlive', function (res) {
        res.on('data', function (buf) {
            config.url += "&key="+buf;
            initPlay(config);
            let i = setInterval(function () {
                http.get('../keepAlive?key='+buf, function (res) {
                    if (res.statusCode>=300)clearInterval(i);
                })
            },15000);
        });
    })
})();