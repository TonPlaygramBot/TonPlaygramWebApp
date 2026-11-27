export type StorefrontBoardPart={shape:string;color:number;p:number[];s:number[]};
export type StorefrontBoardSign={text:string;caption:string;p:number[];s:number[];bg:string;fg:string;yaw:number;plain:true};
export const VERIFIED_STOREFRONT_BOARDS:ReadonlyArray<Readonly<{id:string;buildingId:string;mappedName:string;name:string;kind:string;source:string}>>;
export const STOREFRONT_BOARD_REACH:number;
export function storefrontBoard(site:{id:string;name:string;buildingId?:string;width?:number}):{parts:StorefrontBoardPart[];signs:StorefrontBoardSign[]}|null;
