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
        backgroundColor: Colors.grey[900],
        body: const Center(
          child: AspectRatio(
            aspectRatio: 1,
            child: ChessBoard(),
          ),
        ),
      ),
    );
  }
}

class ChessBoard extends StatefulWidget {
  const ChessBoard({super.key});

  @override
  State<ChessBoard> createState() => _ChessBoardState();
}

class _ChessBoardState extends State<ChessBoard> {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (details) => _handleTap(details.localPosition),
      onPanUpdate: (details) => _handleDrag(details.localPosition),
      child: CustomPaint(
        size: Size.square(40.0 * 8),
        painter: BoardPainter(),
      ),
    );
  }

  void _handleTap(Offset position) {
    // TODO: handle tap on board
  }

  void _handleDrag(Offset position) {
    // TODO: handle drag on board
  }
}

class BoardPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final Paint light = Paint()..color = Colors.brown[200]!;
    final Paint dark = Paint()..color = Colors.brown[700]!;

    double squareSize = size.width / 8;
    for (int row = 0; row < 8; row++) {
      for (int col = 0; col < 8; col++) {
        bool isLight = (row + col) % 2 == 0;
        canvas.drawRect(
          Rect.fromLTWH(
            col * squareSize,
            row * squareSize,
            squareSize,
            squareSize,
          ),
          isLight ? light : dark,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
