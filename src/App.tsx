/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { ref, set, get, onValue, update, remove, onDisconnect } from "firebase/database";
import { db } from "./firebase";
import { motion, AnimatePresence } from "motion/react";
import { Users, LogIn, Plus, ShieldCheck, Timer } from "lucide-react";

interface Player {
  id: string;
  name: string;
}

interface RoomData {
  players: Record<string, Player>;
  status: "waiting" | "starting" | "started";
}

export default function App() {
  const [nickname, setNickname] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Initialize a unique ID for this session
  useEffect(() => {
    setPlayerId(Math.random().toString(36).substring(2, 9));
  }, []);

  const [gameStarted, setGameStarted] = useState(false);

  // Listen to room updates
  useEffect(() => {
    if (!currentRoom) return;

    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as RoomData | null;
      if (data && data.players) {
        const playerList = Object.values(data.players);
        setPlayers(playerList);

        // If 4 players and status is waiting, start countdown
        if (playerList.length === 4 && data.status === "waiting") {
          startCountdown();
        }
        
        // If status is already 'started' (e.g. for players who joined late or re-synced)
        if (data.status === "started") {
          setGameStarted(true);
        }
      } else if (!data) {
        setCurrentRoom(null);
        setError("房間已不存在。");
      }
    });

    const playerRef = ref(db, `rooms/${currentRoom}/players/${playerId}`);
    onDisconnect(playerRef).remove();

    return () => unsubscribe();
  }, [currentRoom, playerId]);

  const startCountdown = async () => {
    if (!currentRoom) return;
    
    // Update status to 'starting' to prevent multiple triggers
    await update(ref(db, `rooms/${currentRoom}`), { status: "starting" });
    
    let count = 10;
    setCountdown(count);
    const timer = setInterval(async () => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        setCountdown(null);
        setGameStarted(true);
        // Mark room as started in Firebase
        await update(ref(db, `rooms/${currentRoom}`), { status: "started" });
      }
    }, 1000);
  };

  const createRoom = async () => {
    if (!nickname.trim()) {
      setError("請先輸入暱稱！");
      return;
    }
    setError("");

    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const roomRef = ref(db, `rooms/${roomCode}`);

    const newPlayer: Player = { id: playerId, name: nickname };
    
    try {
      await set(roomRef, {
        players: { [playerId]: newPlayer },
        status: "waiting",
        createdAt: Date.now()
      });
      setCurrentRoom(roomCode);
      setGameStarted(false);
    } catch (err) {
      setError("建立房間失敗。");
    }
  };

  const joinRoom = async () => {
    if (!nickname.trim()) {
      setError("請先輸入暱稱！");
      return;
    }
    if (!roomInput.trim()) {
      setError("請輸入房間代碼！");
      return;
    }
    setError("");

    const roomRef = ref(db, `rooms/${roomInput}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      setError("找不到該房間！");
      return;
    }

    const data = snapshot.val();
    const currentPlayers = Object.values(data.players || {});

    if (currentPlayers.length >= 4) {
      setError("房間已滿！");
      return;
    }

    if (data.status !== "waiting") {
      setError("遊戲已經在進行中！");
      return;
    }

    const newPlayer: Player = { id: playerId, name: nickname };
    try {
      await update(ref(db, `rooms/${roomInput}/players`), {
        [playerId]: newPlayer
      });
      setCurrentRoom(roomInput);
      setGameStarted(false);
    } catch (err) {
      setError("加入房間失敗。");
    }
  };

  const leaveRoom = async () => {
    if (currentRoom) {
      await remove(ref(db, `rooms/${currentRoom}/players/${playerId}`));
      setCurrentRoom(null);
      setPlayers([]);
      setCountdown(null);
      setGameStarted(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 font-sans text-emerald-900">
      <AnimatePresence mode="wait">
        {gameStarted ? (
          <motion.div
            key="game-started"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-emerald-600 text-white rounded-3xl shadow-2xl p-12 text-center border-8 border-emerald-400"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="inline-block mb-6"
            >
              <ShieldCheck size={100} />
            </motion.div>
            <h1 className="text-6xl font-black mb-4 tracking-tighter">遊戲已開始！</h1>
            <p className="text-emerald-100 text-xl font-bold mb-8">
              四域園丁正式集結，準備好守護這片土地了嗎？
            </p>
            <button
              onClick={leaveRoom}
              className="px-8 py-4 bg-white text-emerald-600 font-black rounded-2xl hover:bg-emerald-50 transition-all active:scale-95"
            >
              返回大廳
            </button>
          </motion.div>
        ) : !currentRoom ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border-4 border-emerald-200"
          >
            <div className="text-center mb-8">
              <h1 className="text-4xl font-black text-emerald-600 tracking-tighter mb-2">
                四域園丁
              </h1>
              <p className="text-emerald-500 font-medium">4 人連線桌遊匹配大廳</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2 ml-1">你的暱稱</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="輸入大名..."
                  className="w-full px-4 py-3 rounded-xl bg-emerald-50 border-2 border-emerald-100 focus:border-emerald-400 focus:ring-0 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={createRoom}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-200 active:scale-95"
                >
                  <Plus size={20} /> 建立新房間
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-emerald-100"></div>
                  <span className="flex-shrink mx-4 text-emerald-300 text-xs font-bold uppercase tracking-widest">
                    或者
                  </span>
                  <div className="flex-grow border-t border-emerald-100"></div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="輸入 4 碼代號"
                    className="flex-grow px-4 py-3 rounded-xl bg-emerald-50 border-2 border-emerald-100 focus:border-emerald-400 focus:ring-0 transition-all outline-none"
                  />
                  <button
                    onClick={joinRoom}
                    className="px-6 py-3 bg-white border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-50 font-bold rounded-xl transition-all active:scale-95"
                  >
                    加入
                  </button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-sm font-bold text-center"
                >
                  {error}
                </motion.p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="waiting-room"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border-4 border-emerald-400 relative overflow-hidden"
          >
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck size={120} />
            </div>

            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-1">
                  正在等待玩家...
                </h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-emerald-600">
                    #{currentRoom}
                  </span>
                  <span className="text-emerald-300 font-bold">房間代碼</span>
                </div>
              </div>
              <button
                onClick={leaveRoom}
                className="text-xs font-bold text-emerald-300 hover:text-red-400 transition-colors"
              >
                離開房間
              </button>
            </div>

            <div className="space-y-3 mb-8">
              {[0, 1, 2, 3].map((index) => {
                const player = players[index];
                return (
                  <motion.div
                    key={index}
                    initial={false}
                    animate={{
                      backgroundColor: player ? "#ecfdf5" : "#f9fafb",
                      borderColor: player ? "#10b981" : "#f3f4f6",
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-all"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        player
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-100 text-gray-300"
                      }`}
                    >
                      {player ? player.name[0].toUpperCase() : index + 1}
                    </div>
                    <div className="flex-grow">
                      <p
                        className={`font-bold ${
                          player ? "text-emerald-900" : "text-gray-300 italic"
                        }`}
                      >
                        {player ? player.name : "等待加入..."}
                      </p>
                    </div>
                    {player && player.id === playerId && (
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full uppercase">
                        你
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {countdown !== null ? (
              <motion.div
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                className="bg-emerald-600 text-white p-6 rounded-2xl text-center shadow-xl"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Timer className="animate-pulse" />
                  <h3 className="text-xl font-black">
                    Game starting in {countdown} seconds!
                  </h3>
                </div>
                <div className="w-full bg-emerald-800 h-2 rounded-full mt-4 overflow-hidden">
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 10, ease: "linear" }}
                    className="h-full bg-white"
                  />
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold">
                <Users size={16} />
                <span>目前人數: {players.length} / 4</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
