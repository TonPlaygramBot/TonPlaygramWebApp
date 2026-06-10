using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [RequireComponent(typeof(AudioSource))]
    public class TennisAudioController : MonoBehaviour
    {
        [Header("Assign imported clips from open-source packs")]
        [Tooltip("Recommended source: Kenney UI Audio + Impact Sounds (CC0): https://kenney.nl/assets")]
        public AudioClip shotClip;
        [Tooltip("Recommended source: Sonniss GDC free packs (license in pack): https://sonniss.com/gameaudiogdc")]
        public AudioClip ballBounceClip;

        [SerializeField, Range(0f, 1f)] private float shotVolume = 0.9f;
        [SerializeField, Range(0f, 1f)] private float bounceVolume = 0.75f;

        private AudioSource _audio;

        private void Awake() => _audio = GetComponent<AudioSource>();

        public void PlayShot()
        {
            if (shotClip != null) _audio.PlayOneShot(shotClip, shotVolume);
        }

        public void PlayBounce()
        {
            if (ballBounceClip != null) _audio.PlayOneShot(ballBounceClip, bounceVolume);
        }
    }
}
