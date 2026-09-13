import { useNavigate } from 'react-router-dom';
import ExploreAlbaniaGame from '../../games/explorealbania/ExploreAlbania';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function ExploreAlbania(){const navigate=useNavigate();useTelegramBackButton();return <ExploreAlbaniaGame onExit={()=>navigate('/games')}/>;}
