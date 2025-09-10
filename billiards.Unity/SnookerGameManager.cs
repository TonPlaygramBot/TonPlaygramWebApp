#if UNITY_5_3_OR_NEWER
using UnityEngine;
using TonPlaygram.Billiards;

/// <summary>
/// Unity wrapper around <see cref="SnookerGameState"/> so the demo scene can
/// drive a basic two player snooker match. The full scoring rules are handled
/// by <c>SnookerGameState</c> – including fouls, alternating turns and clearing
/// the colours once all reds have been potted.
/// </summary>
public class SnookerGameManager : MonoBehaviour
{
    // Number of reds to begin a frame with.
    public int redsInFrame = 15;
    // Optional winning score for the match. A value of zero means the frame
    // ends when all balls are cleared.
    public int targetScore = 0;

    public SnookerGameState State { get; private set; } = new SnookerGameState();

    public int CurrentPlayer => State.CurrentPlayer;
    public int[] Scores => State.Scores;
    public bool GameOver => State.GameOver;

    private void Awake()
    {
        State.ResetGame(redsInFrame, targetScore);
    }

    /// <summary>Call when a ball has been legally potted.</summary>
    public void PotBall(string colour) => State.PotBall(colour);

    /// <summary>Award a foul against the current player.</summary>
    public void Foul(int value) => State.Foul(value);

    /// <summary>End the current player's turn after a miss.</summary>
    public void EndTurn() => State.EndTurn();

    /// <summary>Reset the frame back to its initial state.</summary>
    public void ResetGame()
    {
        State.ResetGame(redsInFrame, targetScore);
    }
}
#endif
