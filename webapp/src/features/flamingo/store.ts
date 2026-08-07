import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FlamingoState {
  joined: string[]; acceptedTasks: string[]; joinedGroups: string[]; toast: string;
  notificationLevel: 'urgent' | 'official' | 'all' | 'none';
  joinProtest: (id: string) => void; acceptTask: (id: string) => void; leaveTask: (id: string) => void; joinGroup: (id: string) => void; setNotificationLevel: (level: FlamingoState['notificationLevel']) => void; notify: (message: string) => void; clearToast: () => void;
}
export const useFlamingoStore = create<FlamingoState>()(persist((set) => ({
  joined: [], acceptedTasks: [], joinedGroups: [], toast: '', notificationLevel: 'official',
  joinProtest: (id) => set((s) => ({ joined: s.joined.includes(id) ? s.joined : [...s.joined, id], toast:'U bashkove. Pjesëmarrja jote mbetet private.' })),
  acceptTask: (id) => set((s) => ({ acceptedTasks: s.acceptedTasks.includes(id) ? s.acceptedTasks : [...s.acceptedTasks, id], toast:'Detyra u shtua te profili yt.' })),
  leaveTask: (id) => set((s) => ({ acceptedTasks: s.acceptedTasks.filter((taskId) => taskId !== id), toast:'Detyra u lirua për një vullnetar tjetër.' })),
  joinGroup: (id) => set((s) => ({ joinedGroups: s.joinedGroups.includes(id) ? s.joinedGroups : [...s.joinedGroups, id], toast:'Kërkesa për grupin u pranua.' })),
  setNotificationLevel: (notificationLevel) => set({ notificationLevel, toast:'Preferencat e njoftimeve u ruajtën.' }),
  notify: (toast) => set({ toast }), clearToast: () => set({ toast:'' })
}), { name:'flamingo-preferences', partialize: ({ joined, acceptedTasks, joinedGroups, notificationLevel }) => ({ joined, acceptedTasks, joinedGroups, notificationLevel }) }));
