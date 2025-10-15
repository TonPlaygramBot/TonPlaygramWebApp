import LuxuryDice from './LuxuryDice.jsx';

export default function DiceSet(props) {
  const { values = [1], rolling = false } = props;
  return (
    <div className="flex gap-4 justify-center items-center">
      {values.map((v, i) => (
        <LuxuryDice key={i} value={v} rolling={rolling} size={values.length > 1 ? 110 : 140} />
      ))}
    </div>
  );
}
