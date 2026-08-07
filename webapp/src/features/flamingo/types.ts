export type Role = 'USER' | 'VOLUNTEER' | 'MODERATOR' | 'ORGANIZER' | 'ADMIN';
export interface User { id: string; name: string; role: Role; avatar: string }
export interface Protest { id: string; title: string; city: string; place: string; date: string; time: string; organizer: string; participants: number; status: 'LIVE' | 'SOT' | 'E ARDHSHME' | 'PËRFUNDUAR'; description: string }
export interface Group { id: string; name: string; description: string; admin: string; members: number; tasks: number }
export interface Task { id: string; title: string; description: string; group: string; priority: 'Lartë' | 'Mesëm' | 'Normal'; people: number; deadline: string; status: 'HAPUR' | 'NË PROCES' | 'PËRFUNDUAR' }
export interface LiveUpdate { id: string; time: string; author: string; type: 'ZYRTARE' | 'URGJENTE' | 'INFO'; text: string; authorRole: 'ZYRTARE' | 'MODERATOR' | 'ANËTAR'; verified: boolean }
export interface Report { category: string; description: string; location?: string; status: 'NË PRITJE' | 'SHQYRTUAR' }
export interface MapLocation { id: string; name: string; type: 'Takim' | 'Ndihmë' | 'Informacion' | 'Transport'; description: string; status: string; hours: string; x: number; y: number }
export interface Document { id: string; title: string; category: string; date: string; author: string }
export interface Notification { id: string; title: string; read: boolean }
export interface OnlineTask { id: string; network: 'Instagram' | 'TikTok' | 'X' | 'Telegram'; title: string; description: string; url: string; reward: number; completed: number; goal: number }
