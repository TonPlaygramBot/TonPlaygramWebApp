import 'dart:math' as math;

import 'package:flutter/material.dart';

void main() {
  runApp(const MyChessApp());
}

class MyChessApp extends StatelessWidget {
  const MyChessApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chess Battle Royale',
      home: Scaffold(
        backgroundColor: const Color(0xFF0F1115),
        body: const SafeArea(
          child: Center(
            child: ChessBattleRoyaleScene(),
          ),
        ),
      ),
      debugShowCheckedModeBanner: false,
    );
  }
}

class ChessBattleRoyaleScene extends StatefulWidget {
  const ChessBattleRoyaleScene({super.key});

  @override
  State<ChessBattleRoyaleScene> createState() => _ChessBattleRoyaleSceneState();
}

class _ChessBattleRoyaleSceneState extends State<ChessBattleRoyaleScene>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ticker;
  final math.Random _rng = math.Random(3);

  final Map<String, PieceState> _livePieces = <String, PieceState>{};
  final List<MissileLaunch> _activeMissiles = <MissileLaunch>[];
  final List<LauncherState> _sideLaunchers = <LauncherState>[];

  double _elapsedSeconds = 0;
  double _spawnCooldown = 0;

  @override
  void initState() {
    super.initState();
    _seedLivePieces();
    _seedParkingSpots();

    _ticker = AnimationController(
      vsync: this,
      duration: const Duration(days: 1),
    )..addListener(_tick);

    _ticker.forward();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _seedLivePieces() {
    _livePieces
      ..clear()
      ..addAll(<String, PieceState>{
        'white_pawn_a': PieceState(type: PieceType.pawn, file: 1.0, rank: 6.0),
        'white_pawn_b': PieceState(type: PieceType.pawn, file: 3.0, rank: 6.0),
        'white_queen': PieceState(type: PieceType.target, file: 4.0, rank: 5.0),
        'black_king': PieceState(type: PieceType.target, file: 4.0, rank: 1.0),
        'black_knight': PieceState(type: PieceType.target, file: 6.0, rank: 2.0),
      });
  }

  void _seedParkingSpots() {
    _sideLaunchers
      ..clear()
      ..addAll(<LauncherState>[
        LauncherState(
          id: 'drone-left',
          type: LauncherType.drone,
          sideAnchor: const Offset(0.06, 0.28),
          centerNudge: const Offset(0.015, 0.0),
          flightSpeed: 0.26,
          liftPixels: 4,
        ),
        LauncherState(
          id: 'jet-right',
          type: LauncherType.jet,
          sideAnchor: const Offset(0.94, 0.36),
          centerNudge: const Offset(-0.02, 0.0),
          flightSpeed: 0.31,
          liftPixels: 5,
        ),
        LauncherState(
          id: 'helicopter-top',
          type: LauncherType.helicopter,
          sideAnchor: const Offset(0.52, 0.04),
          centerNudge: const Offset(0.0, 0.018),
          flightSpeed: 0.24,
          liftPixels: 6,
        ),
        LauncherState(
          id: 'truck-bottom',
          type: LauncherType.longTruck,
          sideAnchor: const Offset(0.50, 0.96),
          centerNudge: const Offset(0.0, -0.016),
          flightSpeed: 0.22,
          liftPixels: 3,
        ),
      ]);
  }

  void _tick() {
    const dt = 1 / 60.0;
    _elapsedSeconds += dt;
    _spawnCooldown -= dt;

    _updateLivePieceMapping(dt);

    if (_spawnCooldown <= 0) {
      _spawnCooldown = 0.9;
      _launchPrecisionStrike();
    }

    for (int i = _activeMissiles.length - 1; i >= 0; i--) {
      final MissileLaunch missile = _activeMissiles[i];
      final PieceState? liveTarget = _livePieces[missile.targetId];
      if (liveTarget == null) {
        _activeMissiles.removeAt(i);
        continue;
      }

      missile.progress += dt * missile.speed;
      final bool complete = missile.progress >= 1.0;
      if (complete) {
        _activeMissiles.removeAt(i);
      }
    }

    if (mounted) {
      setState(() {});
    }
  }

  void _updateLivePieceMapping(double dt) {
    final double t = _elapsedSeconds;
    final PieceState? queen = _livePieces['white_queen'];
    if (queen != null) {
      queen.file = 4 + math.sin(t * 0.7) * 1.1;
      queen.rank = 5 + math.cos(t * 0.6) * 0.5;
    }

    final PieceState? king = _livePieces['black_king'];
    if (king != null) {
      king.file = 4 + math.cos(t * 0.55) * 0.8;
      king.rank = 1 + math.sin(t * 0.8) * 0.35;
    }

    final PieceState? knight = _livePieces['black_knight'];
    if (knight != null) {
      knight.file = 6 + math.sin(t * 0.95) * 0.6;
      knight.rank = 2 + math.cos(t * 1.2) * 0.5;
    }

    for (final MapEntry<String, PieceState> entry in _livePieces.entries) {
      final PieceState piece = entry.value;
      piece.file = piece.file.clamp(0.0, 7.0);
      piece.rank = piece.rank.clamp(0.0, 7.0);
    }

    final PieceState? pawnA = _livePieces['white_pawn_a'];
    if (pawnA != null) {
      pawnA.file = (pawnA.file + dt * 0.09).clamp(0.8, 2.1);
    }

    final PieceState? pawnB = _livePieces['white_pawn_b'];
    if (pawnB != null) {
      pawnB.file = (pawnB.file - dt * 0.08).clamp(2.1, 3.2);
    }
  }

  void _launchPrecisionStrike() {
    final List<String> targets = _livePieces.entries
        .where((MapEntry<String, PieceState> e) => e.value.type == PieceType.target)
        .map((MapEntry<String, PieceState> e) => e.key)
        .toList(growable: false);

    if (targets.isEmpty) {
      return;
    }

    final String targetId = targets[_rng.nextInt(targets.length)];

    for (final LauncherState launcher in _sideLaunchers) {
      _activeMissiles.add(
        MissileLaunch(
          launcherId: launcher.id,
          launcherType: launcher.type,
          targetId: targetId,
          speed: launcher.flightSpeed,
          liftPixels: launcher.liftPixels,
          startMode: MissileStartMode.parkingSpot,
        ),
      );
    }

    final List<String> pawns = _livePieces.entries
        .where((MapEntry<String, PieceState> e) => e.value.type == PieceType.pawn)
        .map((MapEntry<String, PieceState> e) => e.key)
        .toList(growable: false);

    if (pawns.isNotEmpty) {
      final String pawnId = pawns[_rng.nextInt(pawns.length)];
      _activeMissiles.add(
        MissileLaunch(
          launcherId: pawnId,
          launcherType: LauncherType.shortJavelin,
          targetId: targetId,
          speed: 0.36,
          liftPixels: 2,
          startMode: MissileStartMode.livePawn,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double width = constraints.maxWidth.clamp(280, 460);
        final double height = constraints.maxHeight.clamp(560, 920);
        final Size canvasSize = Size(width, height);

        return CustomPaint(
          size: canvasSize,
          painter: BattleBoardPainter(
            livePieces: _livePieces,
            missiles: _activeMissiles,
            launchers: _sideLaunchers,
          ),
        );
      },
    );
  }
}

class BattleBoardPainter extends CustomPainter {
  BattleBoardPainter({
    required this.livePieces,
    required this.missiles,
    required this.launchers,
  });

  final Map<String, PieceState> livePieces;
  final List<MissileLaunch> missiles;
  final List<LauncherState> launchers;

  static const double _framePadding = 18;

  Rect _portraitFrame(Size size) {
    final double side = math.min(
      size.width - (_framePadding * 2),
      (size.height * 0.73) - (_framePadding * 2),
    );
    final double left = (size.width - side) / 2;
    final double top = (size.height * 0.17).clamp(12.0, size.height - side - 12);
    return Rect.fromLTWH(left, top, side, side);
  }

  Offset _squareToPixel(Rect board, double file, double rank) {
    final double s = board.width / 8;
    return Offset(board.left + (file + 0.5) * s, board.top + (rank + 0.5) * s);
  }

  Offset _launcherPixel(Rect board, LauncherState launcher) {
    final Offset nudged = Offset(
      launcher.sideAnchor.dx + launcher.centerNudge.dx,
      launcher.sideAnchor.dy + launcher.centerNudge.dy,
    );

    return Offset(
      board.left + (board.width * nudged.dx),
      board.top + (board.height * nudged.dy),
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    final Rect frame = _portraitFrame(size);
    final Rect board = frame.deflate(10);

    final Paint framePaint = Paint()..color = const Color(0xFFE5E8EF);
    final Paint boardLight = Paint()..color = const Color(0xFFC9A87C);
    final Paint boardDark = Paint()..color = const Color(0xFF6D4C41);

    canvas.drawRRect(
      RRect.fromRectAndRadius(frame, const Radius.circular(14)),
      framePaint,
    );

    final double sq = board.width / 8;
    for (int r = 0; r < 8; r++) {
      for (int f = 0; f < 8; f++) {
        final bool light = (r + f).isEven;
        canvas.drawRect(
          Rect.fromLTWH(board.left + sq * f, board.top + sq * r, sq, sq),
          light ? boardLight : boardDark,
        );
      }
    }

    final Paint parkingPaint = Paint()
      ..color = const Color(0x77E3F2FD)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (final LauncherState launcher in launchers) {
      final Offset p = _launcherPixel(board, launcher);
      canvas.drawCircle(p, 11, parkingPaint);
      _drawLauncherGlyph(canvas, p, launcher.type);
    }

    for (final MissileLaunch missile in missiles) {
      final Offset start = switch (missile.startMode) {
        MissileStartMode.livePawn => _squareToPixel(
            board,
            livePieces[missile.launcherId]?.file ?? 0,
            livePieces[missile.launcherId]?.rank ?? 0,
          ),
        MissileStartMode.parkingSpot => _launcherPixel(
            board,
            launchers.firstWhere((LauncherState l) => l.id == missile.launcherId),
          ),
      };

      final PieceState? liveTarget = livePieces[missile.targetId];
      if (liveTarget == null) {
        continue;
      }

      final Offset end = _squareToPixel(board, liveTarget.file, liveTarget.rank);
      _drawLowPrecisionTrajectory(canvas, start, end, missile);
    }

    for (final MapEntry<String, PieceState> entry in livePieces.entries) {
      _drawPiece(canvas, board, entry.key, entry.value);
    }

    _drawLegend(canvas, size, frame);
  }

  void _drawLauncherGlyph(Canvas canvas, Offset center, LauncherType type) {
    final Paint iconPaint = Paint()..color = const Color(0xFFCFD8DC);
    switch (type) {
      case LauncherType.drone:
        canvas.drawRect(Rect.fromCenter(center: center, width: 8, height: 4), iconPaint);
      case LauncherType.jet:
        canvas.drawPath(
          Path()
            ..moveTo(center.dx, center.dy - 5)
            ..lineTo(center.dx + 4, center.dy + 5)
            ..lineTo(center.dx - 4, center.dy + 5)
            ..close(),
          iconPaint,
        );
      case LauncherType.helicopter:
        canvas.drawCircle(center, 3.5, iconPaint);
        canvas.drawLine(
          Offset(center.dx - 7, center.dy - 5),
          Offset(center.dx + 7, center.dy - 5),
          iconPaint..strokeWidth = 1.7,
        );
      case LauncherType.longTruck:
        canvas.drawRect(Rect.fromCenter(center: center, width: 12, height: 5), iconPaint);
      case LauncherType.shortJavelin:
        canvas.drawCircle(center, 2, iconPaint);
    }
  }

  void _drawLowPrecisionTrajectory(
    Canvas canvas,
    Offset start,
    Offset end,
    MissileLaunch missile,
  ) {
    final double t = missile.progress.clamp(0, 1);
    final Offset current = Offset.lerp(start, end, t)!;

    final double arcHeight = missile.liftPixels * (1 - ((t - 0.5).abs() * 2));
    final Offset arcOffset = Offset(0, -arcHeight);

    final Paint pathPaint = Paint()
      ..color = const Color(0xFF90CAF9)
      ..strokeWidth = missile.launcherType == LauncherType.shortJavelin ? 1.8 : 1.3
      ..style = PaintingStyle.stroke;

    canvas.drawLine(start, current + arcOffset, pathPaint);

    final Paint headPaint = Paint()
      ..color = missile.launcherType == LauncherType.shortJavelin
          ? const Color(0xFFFFC107)
          : const Color(0xFFFF7043);
    canvas.drawCircle(current + arcOffset, missile.launcherType == LauncherType.shortJavelin ? 2.8 : 2.2, headPaint);
  }

  void _drawPiece(Canvas canvas, Rect board, String id, PieceState piece) {
    final Offset p = _squareToPixel(board, piece.file, piece.rank);
    final bool pawn = piece.type == PieceType.pawn;

    final Paint piecePaint = Paint()
      ..color = pawn ? const Color(0xFFFFFFFF) : const Color(0xFF263238);
    final Paint outline = Paint()
      ..color = pawn ? const Color(0xFF000000) : const Color(0xFFECEFF1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    canvas.drawCircle(p, pawn ? 7 : 8, piecePaint);
    canvas.drawCircle(p, pawn ? 7 : 8, outline);

    final TextPainter label = TextPainter(
      text: TextSpan(
        text: pawn ? 'P' : id.startsWith('white') ? 'W' : 'B',
        style: TextStyle(
          color: pawn ? const Color(0xFF1B1F25) : const Color(0xFFEDF3FF),
          fontSize: 8,
          fontWeight: FontWeight.w600,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    label.paint(canvas, p - Offset(label.width / 2, label.height / 2));
  }

  void _drawLegend(Canvas canvas, Size size, Rect frame) {
    final TextPainter title = TextPainter(
      text: const TextSpan(
        text: 'Portrait Precision Strike Frame',
        style: TextStyle(
          color: Color(0xFFE3F2FD),
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: size.width - 24);

    title.paint(canvas, Offset((size.width - title.width) / 2, frame.top - 28));
  }

  @override
  bool shouldRepaint(covariant BattleBoardPainter oldDelegate) => true;
}

enum PieceType { pawn, target }

class PieceState {
  PieceState({required this.type, required this.file, required this.rank});

  final PieceType type;
  double file;
  double rank;
}

enum LauncherType { drone, jet, helicopter, longTruck, shortJavelin }

class LauncherState {
  LauncherState({
    required this.id,
    required this.type,
    required this.sideAnchor,
    required this.centerNudge,
    required this.flightSpeed,
    required this.liftPixels,
  });

  final String id;
  final LauncherType type;
  final Offset sideAnchor;
  final Offset centerNudge;
  final double flightSpeed;
  final double liftPixels;
}

enum MissileStartMode { parkingSpot, livePawn }

class MissileLaunch {
  MissileLaunch({
    required this.launcherId,
    required this.launcherType,
    required this.targetId,
    required this.speed,
    required this.liftPixels,
    required this.startMode,
  });

  final String launcherId;
  final LauncherType launcherType;
  final String targetId;
  final double speed;
  final double liftPixels;
  final MissileStartMode startMode;

  double progress = 0;
}
