using Aiming;
using UnityEngine;
using UnityEngine.UI;

namespace Gameplay.PoolRoyale
{
    [DisallowMultipleComponent]
    public class PoolHumanCharacterTopMenu : MonoBehaviour
    {
        [Header("Top menu wiring")]
        [SerializeField] private Dropdown characterDropdown;
        [SerializeField] private Text selectedCharacterLabel;
        [SerializeField] private AdaptiveAimingEngine aimingEngine;
        [SerializeField] private PoolHumanCharacterRigAligner rigAligner;

        PoolHumanCharacterProfile[] _profiles;

        void Awake()
        {
            _profiles = PoolHumanCharacterProfile.GetAllPresets();
            if (aimingEngine == null) aimingEngine = FindObjectOfType<AdaptiveAimingEngine>();
            if (rigAligner == null) rigAligner = FindObjectOfType<PoolHumanCharacterRigAligner>();
            PopulateDropdown();
        }

        void OnEnable()
        {
            if (characterDropdown != null)
            {
                characterDropdown.onValueChanged.AddListener(SelectByIndex);
            }
        }

        void OnDisable()
        {
            if (characterDropdown != null)
            {
                characterDropdown.onValueChanged.RemoveListener(SelectByIndex);
            }
        }

        public void SelectByIndex(int index)
        {
            if (_profiles == null || _profiles.Length == 0)
                _profiles = PoolHumanCharacterProfile.GetAllPresets();

            index = Mathf.Clamp(index, 0, _profiles.Length - 1);
            PoolHumanCharacterProfile profile = _profiles[index];

            if (aimingEngine != null)
            {
                aimingEngine.SetHumanCharacter(profile.id);
            }

            if (rigAligner != null)
            {
                rigAligner.SelectCharacter(profile.id);
            }

            if (selectedCharacterLabel != null)
            {
                selectedCharacterLabel.text = profile.displayName;
            }
        }

        void PopulateDropdown()
        {
            if (characterDropdown == null)
                return;

            characterDropdown.ClearOptions();
            var options = new System.Collections.Generic.List<string>(_profiles.Length);
            int selectedIndex = 0;
            for (int i = 0; i < _profiles.Length; i++)
            {
                options.Add(_profiles[i].displayName);
                if (aimingEngine != null && _profiles[i].id == aimingEngine.selectedHumanCharacter)
                {
                    selectedIndex = i;
                }
            }

            characterDropdown.AddOptions(options);
            characterDropdown.SetValueWithoutNotify(selectedIndex);
            SelectByIndex(selectedIndex);
        }
    }
}
