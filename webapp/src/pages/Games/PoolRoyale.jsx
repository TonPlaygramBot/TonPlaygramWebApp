import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import PoolUK8 from './PoolUK8.jsx';
import NineBall from './NineBall.jsx';
import American8 from './American8.jsx';

const VARIANT_COMPONENTS = {
  uk: PoolUK8,
  american: American8,
  '9ball': NineBall
};

export default function PoolRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const variantKey = params.get('variant');
  const VariantComponent = VARIANT_COMPONENTS[variantKey] || VARIANT_COMPONENTS.uk;

  return <VariantComponent />;
}
