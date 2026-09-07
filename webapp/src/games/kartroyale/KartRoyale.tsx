import type {ComponentProps} from 'react';
import BaseKartRoyale from './BaseKartRoyale';
import {RacingAtlas} from './RacingAtlas';
export default function KartRoyale(props:ComponentProps<typeof BaseKartRoyale>){return <><BaseKartRoyale {...props}/><RacingAtlas/></>;}
