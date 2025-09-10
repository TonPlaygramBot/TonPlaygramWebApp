#if UNITY_5_3_OR_NEWER
using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Basic snooker scoring and game state manager. Keeps track of the
/// player's score and only ends the game when the target score has been
/// reached. Ball values roughly match standard snooker rules.
/// </summary>
public class SnookerGameManager : MonoBehaviour
{
    public int targetScore = 50;
    public int CurrentScore { get; private set; }
    public bool GameOver => CurrentScore >= targetScore;

    private readonly Dictionary<string, int> ballValues = new Dictionary<string, int>
    {
        {"red", 1},
        {"yellow", 2},
        {"green", 3},
        {"brown", 4},
        {"blue", 5},
        {"pink", 6},
        {"black", 7}
    };

    /// <summary>
    /// Call when a ball has been potted. The colour name is matched to the
    /// standard snooker point table. The game continues until the target
    /// score is reached.
    /// </summary>
    public void PotBall(string colour)
    {
        if (GameOver) return;
        if (ballValues.TryGetValue(colour.ToLowerInvariant(), out int value))
        {
            CurrentScore += value;
        }
        if (GameOver)
        {
            Debug.Log("Game over - target score reached");
        }
    }

    /// <summary>Reset score so a new match can begin.</summary>
    public void ResetGame()
    {
        CurrentScore = 0;
    }
}
#endif
