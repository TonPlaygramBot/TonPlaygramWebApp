import 'dart:ui' as ui;

import 'package:flutter/material.dart';

void main() {
  runApp(const DominoBattleRoyaleApp());
}

class DominoBattleRoyaleApp extends StatelessWidget {
  const DominoBattleRoyaleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Domino Battle Royale',
      home: Scaffold(
        backgroundColor: Colors.grey[900],
        body: const SafeArea(
          child: Center(
            child: AspectRatio(
              aspectRatio: 1,
              child: DominoBoard(),
            ),
          ),
        ),
      ),
    );
  }
}

class DominoBoard extends StatefulWidget {
  const DominoBoard({super.key});

  @override
  State<DominoBoard> createState() => _DominoBoardState();
}

class _DominoBoardState extends State<DominoBoard> {
  final DominoSpriteAtlas _atlas = DominoSpriteAtlas();

  @override
  void dispose() {
    _atlas.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (details) => _handleTap(details.localPosition),
      onPanUpdate: (details) => _handleDrag(details.localPosition),
      child: FutureBuilder<void>(
        future: _atlas.ensureInitialized(),
        builder: (context, snapshot) {
          return CustomPaint(
            size: const Size.square(640),
            painter: BoardPainter(atlas: _atlas, isReady: snapshot.connectionState == ConnectionState.done),
          );
        },
      ),
    );
  }

  void _handleTap(Offset position) {}

  void _handleDrag(Offset position) {}
}

class BoardPainter extends CustomPainter {
  BoardPainter({required this.atlas, required this.isReady});

  final DominoSpriteAtlas atlas;
  final bool isReady;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint light = Paint()..color = Colors.brown[200]!;
    final Paint dark = Paint()..color = Colors.brown[700]!;

    final double squareSize = size.width / 8;
    for (int row = 0; row < 8; row++) {
      for (int col = 0; col < 8; col++) {
        final bool isLight = (row + col) % 2 == 0;
        canvas.drawRect(
          Rect.fromLTWH(col * squareSize, row * squareSize, squareSize, squareSize),
          isLight ? light : dark,
        );
      }
    }

    if (!isReady) {
      final textPainter = TextPainter(
        text: const TextSpan(
          text: 'Loading 4K domino sprites...',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset((size.width - textPainter.width) / 2, (size.height - textPainter.height) / 2));
      return;
    }

    _paintDomino(canvas, const Offset(80, 80), size: const Size(120, 240), topPips: 6, bottomPips: 4);
    _paintDomino(canvas, const Offset(240, 210), size: const Size(240, 120), topPips: 2, bottomPips: 5);
    _paintDomino(canvas, const Offset(460, 90), size: const Size(120, 240), topPips: 1, bottomPips: 1);
  }

  void _paintDomino(
    Canvas canvas,
    Offset position, {
    required Size size,
    required int topPips,
    required int bottomPips,
  }) {
    final ui.Image sprite = atlas.getSprite(topPips, bottomPips);
    final src = Rect.fromLTWH(0, 0, sprite.width.toDouble(), sprite.height.toDouble());
    final dst = Rect.fromLTWH(position.dx, position.dy, size.width, size.height);
    canvas.drawImageRect(
      sprite,
      src,
      dst,
      Paint()
        ..isAntiAlias = true
        ..filterQuality = FilterQuality.high,
    );
  }

  @override
  bool shouldRepaint(covariant BoardPainter oldDelegate) => oldDelegate.isReady != isReady;
}

class DominoSpriteAtlas {
  static const int textureSize = 4096;
  final Map<String, ui.Image> _cache = <String, ui.Image>{};
  Future<void>? _initFuture;

  Future<void> ensureInitialized() {
    return _initFuture ??= _buildDefaultSet();
  }

  Future<void> _buildDefaultSet() async {
    await _createSprite(6, 4);
    await _createSprite(2, 5);
    await _createSprite(1, 1);
  }

  ui.Image getSprite(int top, int bottom) {
    final key = '$top-$bottom';
    final img = _cache[key];
    if (img == null) {
      throw StateError('Sprite $key is not initialized.');
    }
    return img;
  }

  Future<void> _createSprite(int top, int bottom) async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final bounds = Rect.fromLTWH(0, 0, textureSize.toDouble(), textureSize.toDouble());

    final radius = Radius.circular(textureSize * 0.08);
    final bgPaint = Paint()..color = const Color(0xFFF8F5EE);
    final borderPaint = Paint()
      ..color = const Color(0xFF1F1F1F)
      ..style = PaintingStyle.stroke
      ..strokeWidth = textureSize * 0.018
      ..isAntiAlias = true;

    canvas.drawRRect(RRect.fromRectAndRadius(bounds.deflate(textureSize * 0.04), radius), bgPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(bounds.deflate(textureSize * 0.04), radius), borderPaint);

    final dividerY = textureSize / 2;
    canvas.drawLine(
      Offset(textureSize * 0.12, dividerY),
      Offset(textureSize * 0.88, dividerY),
      Paint()
        ..color = const Color(0xFF1F1F1F)
        ..strokeWidth = textureSize * 0.014
        ..strokeCap = StrokeCap.round,
    );

    _drawPips(canvas, Rect.fromLTWH(0, textureSize * 0.08, textureSize.toDouble(), textureSize * 0.40), top);
    _drawPips(canvas, Rect.fromLTWH(0, textureSize * 0.52, textureSize.toDouble(), textureSize * 0.40), bottom);

    final pic = recorder.endRecording();
    _cache['$top-$bottom'] = await pic.toImage(textureSize, textureSize);
  }

  void _drawPips(Canvas canvas, Rect area, int value) {
    final pipPaint = Paint()..color = const Color(0xFF121212);
    final double radius = textureSize * 0.035;
    final left = area.left + area.width * 0.30;
    final centerX = area.center.dx;
    final right = area.left + area.width * 0.70;
    final top = area.top + area.height * 0.25;
    final centerY = area.center.dy;
    final bottom = area.top + area.height * 0.75;

    final Map<int, List<Offset>> pattern = {
      0: [],
      1: [Offset(centerX, centerY)],
      2: [Offset(left, top), Offset(right, bottom)],
      3: [Offset(left, top), Offset(centerX, centerY), Offset(right, bottom)],
      4: [Offset(left, top), Offset(right, top), Offset(left, bottom), Offset(right, bottom)],
      5: [
        Offset(left, top),
        Offset(right, top),
        Offset(centerX, centerY),
        Offset(left, bottom),
        Offset(right, bottom),
      ],
      6: [
        Offset(left, top),
        Offset(right, top),
        Offset(left, centerY),
        Offset(right, centerY),
        Offset(left, bottom),
        Offset(right, bottom),
      ],
    };

    for (final offset in pattern[value] ?? const <Offset>[]) {
      canvas.drawCircle(offset, radius, pipPaint);
    }
  }

  void dispose() {
    for (final image in _cache.values) {
      image.dispose();
    }
    _cache.clear();
  }
}
