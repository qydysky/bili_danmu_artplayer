import Artplayer from 'artplayer';
import mpegts from 'mpegts.js';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';

import ploading from "./img/ploading.gif";
import state from "./img/state.png";
import indicator from "./img/indicator.svg";
import filp from "./img/filp.svg";

(() => {
    let player,
        flvPlayer,
        danmuEmit = document.createElement("div"),
        config = {
            conn: undefined,
            container: '.artplayer-app',
            url: "../stream?_=" + new Date().getTime()+"&ref="+new URL(window.location.href).searchParams.get("ref"),
            title: "" + new Date().getTime(),
            type: "flv",
            volume: 0.5,
            hotkey: false,
            isLive: true,
            muted: false,
            autoplay: true,
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
            autoPlayback: true,
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
                    name: '翻转',
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
                }
            ],
            plugins: [
                artplayerPluginDanmuku({
                    danmuku: [],
                    speed: 7,
                    opacity: 0.7,
                    mount: danmuEmit,
                }),
            ],
            icons: {
                loading: '<img src=' + ploading + '>',
                state: '<img width="150" heigth="150" src=' + state + '>',
                indicator: '<img width="16" heigth="16" src=' + indicator + '>',
            },
            customType: {
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
     function ws() {
        if (window["WebSocket"]) {
            var interval_handle = 0
            var conn = new WebSocket("ws://" + window.location.host + window.location.pathname+"ws?&ref="+new URL(window.location.href).searchParams.get("ref"));
            conn.onclose = function (evt) {
                clearInterval(interval_handle)
            };
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
                conn.send(`pause`);
                config.conn = conn;
            };
            interval_handle = setInterval(()=>{
                if(player.currentTime != undefined)conn.send(player.currentTime);
            },3000);
        }
    }

    function initPlay(config) {
        if(player != undefined && player.destroy != undefined)player.destroy();
        player = new Artplayer(config);
        player.on('play', (...args) => {
            config.conn.send(`play`);
        });
        player.on('pause', (...args) => {
            config.conn.send(`pause`);
        });
        player.on('video:ended', (...args) => {
            if(config.conn != undefined){
                config.conn.close();
                config.conn = undefined;
            }
            if(flvPlayer)flvPlayer.unload();
        });
        player.on('artplayerPluginDanmuku:emit', (danmu) => {
            config.conn.send("%S"+danmu.text);
        });
        document.addEventListener("resize", player.autoSize)
    }
    
    ws();
    initPlay(config);
})();
