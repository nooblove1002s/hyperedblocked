import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:8080").split(",").map(x=>x.trim()).filter(Boolean);
const app = express();
app.disable("x-powered-by");
if(process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(cors({origin(origin,callback){if(!origin||allowedOrigins.includes(origin))return callback(null,true);return callback(new Error("Origin is not allowed by CORS"));},methods:["GET","POST"]}));
app.use(express.json({limit:"12kb"}));
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:allowedOrigins,methods:["GET","POST"]},maxHttpBufferSize:1e5,connectTimeout:10000});
const rooms=new Map();
const socketRoom=new Map();
const socketProfiles=new Map();
const MAX_ROOM_LIMIT=100;
const HEARTBEAT_TTL_MS=45000;
const cleanText=(v,max,fallback="")=>typeof v==="string"?v.trim().slice(0,max):fallback;
const safeEqual=(a,b)=>{const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb);};
function hashPassword(password,salt=randomBytes(16).toString("hex")){return {salt,hash:scryptSync(password,salt,32).toString("hex")};}
function publicRoom(room){
  return {id:room.id,name:room.name,description:room.description,kind:room.kind,visibility:room.visibility,region:room.region,ownerName:room.ownerName,maxPlayers:room.maxPlayers,playerCount:room.players.size,createdAt:room.createdAt};
}
function publicRooms(){return [...rooms.values()].filter(r=>r.visibility==="public"&&r.players.size>0).map(publicRoom).sort((a,b)=>b.playerCount-a.playerCount);}
function counts(){const active=[...rooms.values()].filter(r=>r.players.size>0);return {players:active.reduce((n,r)=>n+r.players.size,0),servers:active.length,openSlots:active.reduce((n,r)=>n+Math.max(0,r.maxPlayers-r.players.size),0)};}
function broadcast(){
  io.emit("server:list",{servers:publicRooms()});
  io.emit("stats:update",counts());
}
function removeSocketFromRoom(socketId){
  const roomId=socketRoom.get(socketId);if(!roomId)return;
  const room=rooms.get(roomId);socketRoom.delete(socketId);
  if(room){room.players.delete(socketId);if(room.players.size===0&&room.kind!=="official")rooms.delete(roomId);}
}
function join(socket,payload,callback=()=>{}){
  const roomId=cleanText(payload?.roomId,80);
  const room=rooms.get(roomId);
  if(!room)return callback({ok:false,error:"Room not found or no longer active."});
  if(room.visibility==="private"&&(!room.passwordHash||!payload?.password||!safeEqual(hashPassword(String(payload.password),room.passwordHash.salt).hash,room.passwordHash.hash)))return callback({ok:false,error:"Incorrect private-room password."});
  if(!room.players.has(socket.id)&&room.players.size>=room.maxPlayers)return callback({ok:false,error:"This server is full."});
  removeSocketFromRoom(socket.id);
  room.players.set(socket.id,{joinedAt:Date.now()});
  socketRoom.set(socket.id,room.id);
  socket.join(room.id);
  broadcast();
  callback({ok:true,room:publicRoom(room)});
}
function rateLimit(socket,event,limit=8,windowMs=10000){
  const now=Date.now();const key=event;const old=socket.data.rates?.[key]||[];
  const recent=old.filter(t=>now-t<windowMs);
  if(recent.length>=limit)return false;
  socket.data.rates={...(socket.data.rates||{}),[key]:[...recent,now]};return true;
}
app.get("/health",(req,res)=>res.json({ok:true,service:"hyperblock-server-browser",time:new Date().toISOString()}));
app.get("/api/servers",(req,res)=>res.set("Cache-Control","no-store").json({servers:publicRooms()}));
app.get("/api/stats",(req,res)=>res.set("Cache-Control","no-store").json(counts()));
app.get("/",(req,res)=>res.type("text").send("Hyperblock multiplayer room API is running. See /health and /api/servers."));
io.on("connection",socket=>{
  socketProfiles.set(socket.id,{name:"Player-"+socket.id.slice(0,5)});
  socket.emit("server:list",{servers:publicRooms()});
  socket.emit("stats:update",counts());
  socket.on("server:refresh",()=>{socket.emit("server:list",{servers:publicRooms()});socket.emit("stats:update",counts());});
  socket.on("profile:set",(payload,callback=()=>{})=>{
    const name=cleanText(payload?.name,24);
    if(!name)return callback({ok:false,error:"Choose a display name."});
    socketProfiles.set(socket.id,{name});callback({ok:true});
  });
  socket.on("room:create",(payload,callback=()=>{})=>{
    if(!rateLimit(socket,"create",5))return callback({ok:false,error:"Too many room creations. Wait a moment."});
    const maxPlayers=Number(payload?.maxPlayers);
    if(!Number.isInteger(maxPlayers)||maxPlayers<1||maxPlayers>MAX_ROOM_LIMIT)return callback({ok:false,error:"Maximum players must be between 1 and "+MAX_ROOM_LIMIT+"."});
    const kind=payload?.kind==="official"?"official":"community";
    // Official rooms must be provisioned by trusted deployment/admin tooling, never by an arbitrary browser client.
    if(kind==="official")return callback({ok:false,error:"Official servers are provisioned by server operators, not created from the public client."});
    const visibility=payload?.visibility==="private"?"private":"public";
    const password=cleanText(payload?.password,100);
    if(visibility==="private"&&password.length<4)return callback({ok:false,error:"Private-room passwords must be at least 4 characters."});
    const id=visibility==="private"?randomBytes(5).toString("hex").toUpperCase():randomUUID();
    const profile=socketProfiles.get(socket.id)||{name:"Player"};
    const room={id,name:cleanText(payload?.name,64,"Community Room")||"Community Room",description:cleanText(payload?.description,180),kind,visibility,region:cleanText(payload?.region,32,"Auto")||"Auto",ownerName:profile.name,maxPlayers,players:new Map(),createdAt:new Date().toISOString(),passwordHash:visibility==="private"?hashPassword(password):null};
    rooms.set(id,room);
    callback({ok:true,room:publicRoom(room)});
    broadcast();
  });
  socket.on("room:join",(payload,callback)=>join(socket,payload,callback));
  socket.on("room:leave",(callback=()=>{})=>{removeSocketFromRoom(socket.id);for(const room of rooms.values())socket.leave(room.id);broadcast();callback({ok:true});});
  socket.on("disconnect",()=>{removeSocketFromRoom(socket.id);socketProfiles.delete(socket.id);broadcast();});
});
const cleanup=setInterval(()=>{
  const cutoff=Date.now()-HEARTBEAT_TTL_MS;
  for(const [roomId,room] of rooms){for(const [socketId,player] of room.players){if(player.joinedAt<cutoff&&!io.sockets.sockets.has(socketId)){room.players.delete(socketId);socketRoom.delete(socketId);}}if(room.players.size===0&&room.kind!=="official")rooms.delete(roomId);}
  broadcast();
},15000);
cleanup.unref();
httpServer.listen(PORT,()=>console.log("Hyperblock server browser listening on port",PORT));
