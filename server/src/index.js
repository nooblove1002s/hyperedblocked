import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3000);
const allowedOrigins = [...new Set(["https://nooblove1002s.github.io", ...(process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:8080").split(",").map(x=>x.trim()).filter(Boolean)])];
const app = express();
app.disable("x-powered-by");
if(process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(cors({origin(origin,callback){if(!origin||allowedOrigins.includes(origin))return callback(null,true);return callback(new Error("Origin is not allowed by CORS"));},methods:["GET","POST"]}));
app.use(express.json({limit:"12kb"}));
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:allowedOrigins,methods:["GET","POST"]},maxHttpBufferSize:1e5,connectTimeout:10000});
const SERVER_DIR=path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR=path.resolve(process.env.HYPERBLOCK_DATA_DIR||path.join(SERVER_DIR,"../data"));
const PEOPLE_FILE=path.join(DATA_DIR,"people.json");
let registeredPeople=[];
let nextPersonId=1;
let peopleWrite=Promise.resolve();
async function loadRegisteredPeople(){
  await mkdir(DATA_DIR,{recursive:true});
  try{
    const parsed=JSON.parse(await readFile(PEOPLE_FILE,"utf8"));
    registeredPeople=Array.isArray(parsed.people)?parsed.people.filter(p=>Number.isInteger(p.id)&&typeof p.name==="string"&&typeof p.clientId==="string"): [];
    nextPersonId=Math.max(0,...registeredPeople.map(p=>p.id))+1;
  }catch(error){
    if(error.code!=="ENOENT")console.error("Could not read private people registry:",error.message);
    registeredPeople=[];
    nextPersonId=1;
    await persistRegisteredPeople();
  }
}
function persistRegisteredPeople(){
  const snapshot=JSON.stringify({version:1,people:registeredPeople},null,2);
  peopleWrite=peopleWrite.catch(()=>{}).then(async()=>{await mkdir(DATA_DIR,{recursive:true});await writeFile(PEOPLE_FILE,snapshot,{encoding:"utf8",mode:0o600});});
  return peopleWrite;
}
function publicRegisteredPeople(){
  return registeredPeople.map(({id,name,createdAt})=>({id,name,createdAt}));
}
const rooms=new Map();
// Permanent public entry point. Store the oversized capacity as a string so JSON
// preserves every digit exactly; capacity comparisons coerce it to Number safely
// for realistic player counts.
const GLOBAL_SERVER_CAPACITY="8794237893427893247";
rooms.set("hyperblock-global",{
  id:"hyperblock-global",
  name:"Hyperblock Global Server",
  description:"The public global room. Anyone can join.",
  kind:"official",
  visibility:"public",
  region:"Global",
  ownerName:"HYPERBLOCK",
  maxPlayers:GLOBAL_SERVER_CAPACITY,
  players:new Map(),
  createdAt:new Date().toISOString(),
  passwordHash:null
});
const socketRoom=new Map();
const socketProfiles=new Map();
const bannedClientIds=new Map();
let corruptionEnabled=false;
function adminAuth(req,res,next){
  const configured=process.env.ADMIN_API_KEY||"";
  const supplied=req.get("x-admin-key")||"";
  if(!configured||!safeEqual(supplied,configured))return res.status(401).json({error:"Admin authentication failed."});
  next();
}
function publicPeople(){
  const people=[];
  for(const [socketId,roomId] of socketRoom){
    const profile=socketProfiles.get(socketId)||{name:"Player"};
    const room=rooms.get(roomId);
    people.push({socketId,clientId:profile.clientId||"",id:profile.id||null,name:profile.name||"Player",roomId,roomName:room?.name||"Unknown room",joinedAt:room?.players.get(socketId)?.joinedAt||null});
  }
  return people;
}
const MAX_ROOM_LIMIT=100;
const HEARTBEAT_TTL_MS=45000;
const cleanText=(v,max,fallback="")=>typeof v==="string"?v.trim().slice(0,max):fallback;
const safeEqual=(a,b)=>{const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb);};
function hashPassword(password,salt=randomBytes(16).toString("hex")){return {salt,hash:scryptSync(password,salt,32).toString("hex")};}
function publicRoom(room){
  return {id:room.id,name:room.name,description:room.description,kind:room.kind,visibility:room.visibility,region:room.region,ownerName:room.ownerName,maxPlayers:room.maxPlayers,playerCount:room.players.size,createdAt:room.createdAt};
}
function publicRooms(){return [...rooms.values()].filter(r=>r.visibility==="public"&&(r.players.size>0||r.kind==="official")).map(publicRoom).sort((a,b)=>b.playerCount-a.playerCount);}
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
  const profile=socketProfiles.get(socket.id)||{};
  if(!profile.id)return callback({ok:false,error:"Choose and register a Hyperblock player name before joining a room."});
  if(profile.clientId&&bannedClientIds.has(profile.clientId))return callback({ok:false,error:"This player is banned from Hyperblock multiplayer."});
  const roomId=cleanText(payload?.roomId,80);
  const room=rooms.get(roomId);
  if(!room)return callback({ok:false,error:"Room not found or no longer active."});
  if(socketRoom.get(socket.id)===room.id)return callback({ok:true,room:publicRoom(room)});
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
app.post("/api/admin/servers",(req,res)=>{
  const configured=process.env.ADMIN_API_KEY;
  const supplied=req.get("x-admin-key")||"";
  if(!configured||!safeEqual(supplied,configured))return res.status(401).json({error:"Unauthorized"});
  const maxPlayers=Number(req.body?.maxPlayers??20);
  if(!Number.isInteger(maxPlayers)||maxPlayers<1||maxPlayers>MAX_ROOM_LIMIT)return res.status(400).json({error:"maxPlayers must be between 1 and "+MAX_ROOM_LIMIT});
  const id=cleanText(req.body?.id,80)||"official-"+randomUUID();
  const room={id,name:cleanText(req.body?.name,64,"Official Server")||"Official Server",description:cleanText(req.body?.description,180),kind:"official",visibility:"public",region:cleanText(req.body?.region,32,"Auto")||"Auto",ownerName:"HYPERBLOCK OFFICIAL",maxPlayers,players:new Map(),createdAt:new Date().toISOString(),passwordHash:null};
  rooms.set(id,room);broadcast();res.status(201).json({ok:true,server:publicRoom(room)});
});
app.post("/api/identity/register",async(req,res)=>{
  const name=cleanText(req.body?.name,24);
  const clientId=cleanText(req.body?.clientId,100);
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(clientId))return res.status(400).json({error:"A valid browser identity is required."});
  if(name.length<2)return res.status(400).json({error:"Choose a name with at least 2 characters."});
  if(bannedClientIds.has(clientId))return res.status(403).json({error:"This browser identity is banned from Hyperblock."});
  let person=registeredPeople.find(p=>p.clientId===clientId);
  if(person){
    if(person.name!==name){person.name=name;person.updatedAt=new Date().toISOString();try{await persistRegisteredPeople()}catch{return res.status(500).json({error:"Could not save the private player registry. Check backend storage permissions."});}}
  }else{
    person={id:nextPersonId++,name,clientId,createdAt:new Date().toISOString()};
    registeredPeople.push(person);
    try{await persistRegisteredPeople()}catch(error){registeredPeople=registeredPeople.filter(p=>p.clientId!==clientId);nextPersonId=Math.max(0,...registeredPeople.map(p=>p.id))+1;return res.status(500).json({error:"Could not save the private player registry. Check backend storage permissions."});}
  }
  res.set("Cache-Control","no-store").json({ok:true,id:person.id,name:person.name,clientId:person.clientId});
});
app.get("/api/admin/people",adminAuth,(req,res)=>res.set("Cache-Control","no-store").json({people:publicPeople(),registeredPeople:publicRegisteredPeople(),corruptionEnabled}));
app.post("/api/admin/ban",adminAuth,(req,res)=>{
  const clientId=cleanText(req.body?.clientId,100);
  const action=req.body?.action==="unban"?"unban":"ban";
  if(!clientId)return res.status(400).json({error:"clientId is required."});
  if(action==="unban"){bannedClientIds.delete(clientId);return res.json({ok:true,action,clientId});}
  const reason=cleanText(req.body?.reason,180,"Banned by an administrator");
  bannedClientIds.set(clientId,{reason,at:new Date().toISOString()});
  for(const [socketId,profile] of socketProfiles){
    if(profile.clientId===clientId){
      removeSocketFromRoom(socketId);
      const client=io.sockets.sockets.get(socketId);
      client?.emit("moderation:banned",{reason});
      client?.disconnect(true);
    }
  }
  broadcast();
  res.json({ok:true,action,clientId,reason});
});
app.get("/api/admin/corruption",adminAuth,(req,res)=>res.json({enabled:corruptionEnabled}));
app.post("/api/admin/corruption",adminAuth,(req,res)=>{
  corruptionEnabled=!!req.body?.enabled;
  io.emit("corruption:update",{enabled:corruptionEnabled});
  res.json({ok:true,enabled:corruptionEnabled});
});
app.get("/api/servers",(req,res)=>res.set("Cache-Control","no-store").json({servers:publicRooms()}));
app.get("/api/stats",(req,res)=>res.set("Cache-Control","no-store").json(counts()));
app.get("/",(req,res)=>res.type("text").send("Hyperblock multiplayer room API is running. See /health and /api/servers."));
io.on("connection",socket=>{
  socketProfiles.set(socket.id,{name:"Player-"+socket.id.slice(0,5)});
  socket.emit("corruption:update",{enabled:corruptionEnabled});
  socket.emit("server:list",{servers:publicRooms()});
  socket.emit("stats:update",counts());
  socket.on("server:refresh",()=>{socket.emit("server:list",{servers:publicRooms()});socket.emit("stats:update",counts());});
  socket.on("profile:set",(payload,callback=()=>{})=>{
    const name=cleanText(payload?.name,24)||"Player-"+socket.id.slice(0,5);
    const clientId=cleanText(payload?.clientId,100);
    if(clientId&&bannedClientIds.has(clientId)){
      callback({ok:false,error:"This player is banned from Hyperblock multiplayer."});
      socket.disconnect(true);return;
    }
    const person=registeredPeople.find(p=>p.clientId===clientId);
    if(!person){callback({ok:false,error:"Register your Hyperblock name before connecting."});socket.disconnect(true);return;}
    socketProfiles.set(socket.id,{name:person.name,clientId,id:person.id});callback({ok:true,id:person.id,name:person.name});
  });
  socket.on("room:create",(payload,callback=()=>{})=>{
    if(!socketProfiles.get(socket.id)?.id)return callback({ok:false,error:"Register your Hyperblock player name before creating a room."});
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
await loadRegisteredPeople();
httpServer.listen(PORT,()=>console.log("Hyperblock server browser listening on port",PORT));
