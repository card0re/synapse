import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert } from "lucide-react"
import toast from 'react-hot-toast'
import { useWebSocket } from "../contexts/WebSocketContext" // 👈 Використовуємо глобальний сокет

interface Message {
    id?: number; deal_id?: string; sender_id: string; receiver_id: string;
    text: string; created_at: string; is_read?: boolean; reaction?: string;
    is_edited?: boolean; reply_to_id?: number; reply_to_text?: string;
}
interface ChatContact { partner_id: string; partner_name: string; partner_avatar: string; last_message: string; last_message_at: string; unread_count?: number; is_pinned?: boolean; is_blocked?: boolean; }

export default function Chat() {
    const { partnerId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    const initialPartnerName = location.state?.partnerName
    const initialPartnerAvatar = location.state?.partnerAvatar

    const [contacts, setContacts] = useState<ChatContact[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState("")

    // 👇 Стейт та рефи для статусу "друкує..." та textarea
    const [isPartnerTyping, setIsPartnerTyping] = useState(false)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastTypingTimeRef = useRef<number>(0)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const { ws, lastMessage } = useWebSocket() // 👈 Беремо ws з глобального провайдера

    const [editingMsgId, setEditingMsgId] = useState<number | null>(null)
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msg: Message } | null>(null)
    const [isChatMenuOpen, setIsChatMenuOpen] = useState(false)

    const [confirmModal, setConfirmModal] = useState<{type: 'delete' | 'block', partnerId: string, partnerName: string} | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const myId = localStorage.getItem("userId")
    const token = localStorage.getItem("token")

    const loadContacts = async () => {
        if (!token || !myId) return;
        try {
            const [chatsRes, prefsRes] = await Promise.all([
                fetch(`http://localhost:3000/api/users/${myId}/chats`, { headers: { "Authorization": `Bearer ${token}` } }),
                fetch(`http://localhost:3000/api/users/${myId}/chat-preferences`, { headers: { "Authorization": `Bearer ${token}` } })
            ]);

            const chats = await chatsRes.json();
            const prefs = await prefsRes.json();

            if (Array.isArray(chats)) {
                const combined = chats.map((c: any) => {
                    const pref = prefs.find((p: any) => p.partner_id === c.partner_id);
                    return { ...c, is_pinned: pref?.is_pinned || false, is_blocked: pref?.is_blocked || false };
                });

                combined.sort((a: any, b: any) => {
                    if (a.is_pinned && !b.is_pinned) return -1;
                    if (!a.is_pinned && b.is_pinned) return 1;
                    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
                });
                setContacts(combined);
            }
        } catch (error) { console.error(error) }
    }

    const loadMessages = (partner_id: string) => {
        fetch(`http://localhost:3000/api/users/${myId}/chats/${partner_id}`, { headers: { "Authorization": `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setMessages(data) })
    }

    useEffect(() => {
        loadContacts()
        if (partnerId) loadMessages(partnerId)
    }, [partnerId, token, myId])

    useEffect(() => {
        if (partnerId && token && myId) {
            fetch(`http://localhost:3000/api/users/${myId}/chats/${partnerId}/read`, {
                method: "PUT", headers: { "Authorization": `Bearer ${token}` }
            }).then(() => loadContacts())
        }
    }, [partnerId, messages.length, token, myId])

    useEffect(() => {
        const handleClick = () => { setContextMenu(null); setIsChatMenuOpen(false); };
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    // 👇 ОБРОБКА ПОВІДОМЛЕНЬ ІЗ ГЛОБАЛЬНОГО КОНТЕКСТУ 👇
    useEffect(() => {
        if (!lastMessage || !myId) return;

        const data = lastMessage;

        if (data.type === "error") {
            toast.error(data.text);
            return;
        }

        // Ловимо статус "друкує..."
        if (data.type === "typing" && data.sender_id === partnerId) {
            setIsPartnerTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 2000);
            return;
        }

        if (data.type === "read_receipt" && data.reader_id === partnerId) {
            setMessages(prev => prev.map(m => m.sender_id === myId ? { ...m, is_read: true } : m))
            return
        }

        if (data.type === "edit_message") {
            setMessages(prev => prev.map(m => m.id === data.id ? { ...m, text: data.text, is_edited: true } : m))
            return
        }

        if (data.type === "reaction_message") {
            setMessages(prev => prev.map(m => m.id === data.id ? { ...m, reaction: data.reaction } : m))
            return
        }

        if (data.type === "new_message" || (!data.type && data.sender_id)) {
            setMessages(prev => {
                if (prev.find(m => m.id === data.id)) return prev;
                return [...prev, data];
            })
            if (data.sender_id === partnerId) {
                fetch(`http://localhost:3000/api/users/${myId}/chats/${partnerId}/read`, {
                    method: "PUT", headers: { "Authorization": `Bearer ${token}` }
                })
            }
            loadContacts()
        }
    }, [lastMessage, partnerId, myId, token]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

    // 👇 ЛОГІКА ПОЛЯ ВВОДУ TEXTAREA 👇
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = `${e.target.scrollHeight}px`

        // Відправляємо сигнал "друкує..." раз на 2 секунди
        if (ws && partnerId) {
            const now = Date.now()
            if (now - lastTypingTimeRef.current > 2000) {
                ws.send(JSON.stringify({ action: "typing", receiver_id: partnerId }))
                lastTypingTimeRef.current = now
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage(e as any)
        }
    }

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !ws || !partnerId) return

        if (editingMsgId) {
            ws.send(JSON.stringify({ action: "edit", id: editingMsgId, receiver_id: partnerId, text: newMessage }));
            setEditingMsgId(null);
            setNewMessage("");
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            return;
        }

        const payload: any = { action: "send", receiver_id: partnerId, text: newMessage }
        if (replyingTo) {
            payload.reply_to_id = replyingTo.id;
            payload.reply_to_text = replyingTo.text;
        }

        ws.send(JSON.stringify(payload))
        setNewMessage("")
        setReplyingTo(null)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'; // Скидання висоти
    }

    const handleRightClick = (e: React.MouseEvent, msg: Message) => {
        e.preventDefault();
        setContextMenu({ x: e.pageX, y: e.pageY, msg });
    }

    const handleReactionClick = (emoji: string) => {
        if (contextMenu?.msg.id && ws && partnerId) {
            const newReaction = contextMenu.msg.reaction === emoji ? "" : emoji;
            ws.send(JSON.stringify({ action: "reaction", id: contextMenu.msg.id, receiver_id: partnerId, reaction: newReaction }));
            setContextMenu(null);
        }
    }

    const handlePinChat = async () => {
        if (!partnerId) return;
        await fetch(`http://localhost:3000/api/users/${myId}/pin/${partnerId}`, { method: "PUT" });
        loadContacts();
        setIsChatMenuOpen(false);
    }

    const handleBlockClick = () => {
        if (currentPartner?.is_blocked) {
            executeBlockToggle();
        } else {
            setConfirmModal({ type: 'block', partnerId: partnerId!, partnerName: displayName });
        }
        setIsChatMenuOpen(false);
    }

    const executeBlockToggle = async () => {
        const targetId = confirmModal?.partnerId || partnerId;
        if (!targetId) return;

        await fetch(`http://localhost:3000/api/users/${myId}/block/${targetId}`, { method: "PUT" });
        await loadContacts();
        setConfirmModal(null);
        toast.success(currentPartner?.is_blocked ? "Користувача розблоковано!" : "Користувача заблоковано!");
    }

    const executeDeleteChat = async () => {
        if (!confirmModal?.partnerId) return;
        try {
            const res = await fetch(`http://localhost:3000/api/users/${myId}/chats/${confirmModal.partnerId}`, {
                method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("🗑 Чат видалено!");
                setContacts(prev => prev.filter(c => c.partner_id !== confirmModal.partnerId));
                setConfirmModal(null);
                navigate('/chat');
            }
        } catch (error) { toast.error("Помилка сервера"); }
    }

    const currentPartner = contacts.find(c => c.partner_id === partnerId)
    const displayName = currentPartner?.partner_name || initialPartnerName || "Співрозмовник"
    const displayAvatar = currentPartner?.partner_avatar || initialPartnerAvatar || `https://ui-avatars.com/api/?name=${displayName}&background=c7d2fe&color=3730a3`
    const isBlocked = currentPartner?.is_blocked;
    const isPinned = currentPartner?.is_pinned;

    if (!myId) return <div className="p-8 text-center">Увійдіть в акаунт</div>

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors duration-300 relative">

            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 text-2xl">⚠️</div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Підтвердження</h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-8 text-lg leading-relaxed">
                            {confirmModal.type === 'delete'
                                ? "Ви дійсно хочете назавжди видалити історію цього чату?"
                                : `Ви дійсно хочете заблокувати користувача ${confirmModal.partnerName}? Він більше не зможе вам писати.`}
                        </p>
                        <div className="flex gap-3">
                            <Button
                                onClick={confirmModal.type === 'delete' ? executeDeleteChat : executeBlockToggle}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-12"
                            >
                                {confirmModal.type === 'delete' ? "Видалити чат" : "Заблокувати"}
                            </Button>
                            <Button onClick={() => setConfirmModal(null)} variant="outline" className="flex-1 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-12">Скасувати</Button>
                        </div>
                    </div>
                </div>
            )}

            {contextMenu && (
                <div
                    className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl py-2 px-3 w-[220px] animate-in fade-in zoom-in-95 flex flex-col gap-2"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="flex justify-between items-center px-1">
                        {['❤️', '👍', '😂', '😲', '😢', '👎'].map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleReactionClick(emoji)}
                                className={`text-xl hover:scale-125 transition-transform p-1 ${contextMenu.msg.reaction === emoji ? 'bg-slate-200 dark:bg-slate-600 rounded-full' : ''}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>

                    <hr className="border-slate-200 dark:border-slate-700" />
                    <button onClick={() => { setReplyingTo(contextMenu.msg); setEditingMsgId(null); setNewMessage(""); setContextMenu(null); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-md">↩️ Відповісти</button>
                    {contextMenu.msg.sender_id === myId && (
                        <button onClick={() => { setEditingMsgId(contextMenu.msg.id!); setNewMessage(contextMenu.msg.text); setReplyingTo(null); setContextMenu(null); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-md">✏️ Редагувати</button>
                    )}
                </div>
            )}

            <div className="max-w-6xl mx-auto h-[85vh] flex gap-4">

                <Card className="w-1/3 hidden md:flex flex-col shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 py-4">
                        <CardTitle className="text-lg text-slate-800 dark:text-slate-100">💬 Мої діалоги</CardTitle>
                    </CardHeader>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {contacts.length === 0 ? (
                            <p className="p-4 text-slate-500 text-center text-sm">У вас ще немає чатів.</p>
                        ) : (
                            contacts.map(c => {
                                const hasUnread = c.unread_count ? c.unread_count > 0 : false;
                                return (
                                    <div
                                        key={c.partner_id}
                                        onClick={() => navigate(`/chat/${c.partner_id}`)}
                                        className={`flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer transition-colors ${partnerId === c.partner_id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent'}`}
                                    >
                                        <img src={c.partner_avatar || `https://ui-avatars.com/api/?name=${c.partner_name}&background=c7d2fe&color=3730a3`} alt="ava" className="w-12 h-12 rounded-full object-cover" />
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h4 className={`truncate flex items-center gap-1 ${hasUnread ? 'font-black text-indigo-700 dark:text-indigo-400' : 'font-bold text-slate-900 dark:text-slate-100'}`}>
                                                    {c.is_pinned && <span className="text-xs">📌</span>}
                                                    {c.partner_name}
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    {hasUnread && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.unread_count}</span>}
                                                    <span className={`text-[10px] whitespace-nowrap ${hasUnread ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'}`}>
                                                        {new Date(c.last_message_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className={`text-sm truncate ${hasUnread ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {c.last_message}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Card>

                <Card className="flex-1 flex flex-col shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                    {partnerId ? (
                        <>
                            <CardHeader className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 py-3 px-6 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={displayAvatar} alt="ava" className="w-10 h-10 rounded-full" />
                                    <div>
                                        <CardTitle className="text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            {displayName}
                                            {isBlocked && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Заблоковано</span>}
                                        </CardTitle>
                                    </div>
                                </div>

                                <div className="relative">
                                    <button onClick={(e) => { e.stopPropagation(); setIsChatMenuOpen(!isChatMenuOpen); }} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                    </button>

                                    {isChatMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl py-2 z-50 animate-in fade-in zoom-in-95">
                                            <button onClick={handlePinChat} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors">
                                                {isPinned ? "📌 Відкріпити чат" : "📌 Закріпити чат"}
                                            </button>
                                            <hr className="border-slate-200 dark:border-slate-700 my-1" />
                                            <button onClick={() => { setIsChatMenuOpen(false); setConfirmModal({ type: 'delete', partnerId: partnerId!, partnerName: displayName }); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors">
                                                🗑 Видалити чат
                                            </button>
                                            <button onClick={handleBlockClick} className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition-colors">
                                                {isBlocked ? "✅ Розблокувати користувача" : "🚫 Заблокувати користувача"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50 custom-scrollbar">

                                <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/50 p-3 rounded-xl mb-6 shadow-sm mx-auto max-w-2xl flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-amber-800 dark:text-amber-400/90 leading-relaxed text-center w-full pr-5">
                                        <strong>Увага!</strong> Ніколи не діліться паролями, фінансовою інформацією чи точною адресою. Не переходьте за підозрілими посиланнями. Усі домовленості щодо уроків фіксуються виключно через інтерфейс платформи.
                                    </p>
                                </div>

                                {messages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-400">Напишіть перше повідомлення 👋</div>
                                ) : (
                                    messages.map((msg, index) => {
                                        const isMe = msg.sender_id === myId
                                        return (
                                            <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative group`} onContextMenu={(e) => handleRightClick(e, msg)}>
                                                <div className={`max-w-[75%] px-4 py-2 rounded-2xl relative ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>

                                                    {msg.reply_to_text && (
                                                        <div className={`mb-2 pl-2 border-l-2 text-xs opacity-80 ${isMe ? 'border-indigo-300 bg-indigo-700/30' : 'border-indigo-500 bg-slate-100 dark:bg-slate-700/50'} rounded-r-md py-1 pr-2`}>
                                                            <div className="font-bold mb-0.5">Відповідь</div>
                                                            <div className="truncate line-clamp-1">{msg.reply_to_text}</div>
                                                        </div>
                                                    )}

                                                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>

                                                    {msg.reaction && (
                                                        <div className={`absolute -bottom-3 ${isMe ? '-left-2' : '-right-2'} bg-white dark:bg-slate-800 rounded-full px-1.5 py-0.5 shadow border border-slate-100 dark:border-slate-700 text-sm`}>
                                                            {msg.reaction}
                                                        </div>
                                                    )}

                                                    <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                        {msg.is_edited && <span className="text-[9px] italic mr-1">(редаговано)</span>}
                                                        <p className="text-[10px]">
                                                            {new Date(msg.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                        {isMe && <span className="text-[10px] font-bold tracking-tighter ml-1">{msg.is_read ? "✓✓" : "✓"}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </CardContent>

                            <CardFooter className="p-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col">
                                {editingMsgId && (
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 px-4 py-2 flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">✏️ Редагування повідомлення...</span>
                                        <button onClick={() => { setEditingMsgId(null); setNewMessage(""); }} className="text-slate-500 hover:text-red-500 font-bold">✕</button>
                                    </div>
                                )}
                                {replyingTo && (
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 px-4 py-2 flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700">
                                        <div className="flex flex-col border-l-2 border-indigo-500 pl-2">
                                            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs">Відповідь</span>
                                            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[250px] text-xs">{replyingTo.text}</span>
                                        </div>
                                        <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-red-500 font-bold px-2">✕</button>
                                    </div>
                                )}
                                <div className="p-4 w-full relative">
                                    {isBlocked && (
                                        <div className="absolute inset-0 z-10 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-[1px] flex items-center justify-center rounded-b-xl">
                                            <span className="font-bold text-slate-500 dark:text-slate-400">Ви заблокували цього користувача</span>
                                        </div>
                                    )}

                                    {/* 👇 ІНДИКАТОР ПЕЧАТУ 👇 */}
                                    {isPartnerTyping && (
                                        <div className="absolute -top-6 left-4 text-xs font-bold text-indigo-500 animate-pulse">
                                            {displayName} друкує...
                                        </div>
                                    )}

                                    <form onSubmit={sendMessage} className="flex w-full gap-2 items-end">
                                        {/* 👇 TEXTAREA ЗАМІСТЬ INPUT 👇 */}
                                        <textarea
                                            ref={textareaRef}
                                            placeholder="Напишіть повідомлення... (Enter для відправки)"
                                            value={newMessage}
                                            onChange={handleInput}
                                            onKeyDown={handleKeyDown}
                                            rows={1}
                                            className="flex-1 resize-none min-h-[44px] max-h-[120px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 custom-scrollbar dark:text-white"
                                        />
                                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 h-[44px] rounded-xl mb-[1px]">
                                            {editingMsgId ? "Зберегти" : "Відправити"}
                                        </Button>
                                    </form>
                                </div>
                            </CardFooter>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-50 dark:bg-slate-950/50">
                            👈 Оберіть діалог зліва, щоб розпочати спілкування
                        </div>
                    )}
                </Card>

            </div>
        </div>
    )
}