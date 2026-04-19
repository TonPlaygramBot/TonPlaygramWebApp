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
        body: const SafeArea(
          child: Center(
            child: AspectRatio(
              aspectRatio: 1,
              child: ChessBoard(),
            ),
          ),
        ),
      ),
    );
  }
}

enum PieceColor { white, black }

enum PieceType { king, queen, rook, bishop, knight, pawn }

enum PieceAnim { idle, selected, move, capture, invalid }

class AnimationSpec {
  const AnimationSpec({
    required this.duration,
    required this.curve,
    required this.scale,
    this.glow,
    this.shake = false,
  });

  final Duration duration;
  final Curve curve;
  final double scale;
  final Color? glow;
  final bool shake;
}

const Map<PieceAnim, AnimationSpec> kAnimationMap = {
  PieceAnim.idle: AnimationSpec(
    duration: Duration(milliseconds: 120),
    curve: Curves.linear,
    scale: 1,
  ),
  PieceAnim.selected: AnimationSpec(
    duration: Duration(milliseconds: 160),
    curve: Curves.easeOut,
    scale: 1.1,
    glow: Colors.amber,
  ),
  PieceAnim.move: AnimationSpec(
    duration: Duration(milliseconds: 260),
    curve: Curves.easeInOutCubic,
    scale: 1.06,
  ),
  PieceAnim.capture: AnimationSpec(
    duration: Duration(milliseconds: 320),
    curve: Curves.easeOutBack,
    scale: 1.15,
    glow: Colors.redAccent,
  ),
  PieceAnim.invalid: AnimationSpec(
    duration: Duration(milliseconds: 180),
    curve: Curves.easeInOut,
    scale: 0.93,
    glow: Colors.orange,
    shake: true,
  ),
};

class ChessPiece {
  ChessPiece({
    required this.id,
    required this.color,
    required this.type,
    required this.row,
    required this.col,
    this.anim = PieceAnim.idle,
  });

  final String id;
  final PieceColor color;
  final PieceType type;
  int row;
  int col;
  PieceAnim anim;

  String get icon {
    final white = color == PieceColor.white;
    switch (type) {
      case PieceType.king:
        return white ? '♔' : '♚';
      case PieceType.queen:
        return white ? '♕' : '♛';
      case PieceType.rook:
        return white ? '♖' : '♜';
      case PieceType.bishop:
        return white ? '♗' : '♝';
      case PieceType.knight:
        return white ? '♘' : '♞';
      case PieceType.pawn:
        return white ? '♙' : '♟';
    }
  }
}

class ChessBoard extends StatefulWidget {
  const ChessBoard({super.key});

  @override
  State<ChessBoard> createState() => _ChessBoardState();
}

class _ChessBoardState extends State<ChessBoard> {
  static const int _boardSize = 8;

  final List<ChessPiece> _pieces = _initialPieces();
  String? _selectedPieceId;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final boardPx = constraints.biggest.shortestSide;
        final square = boardPx / _boardSize;

        return GestureDetector(
          onTapDown: (details) => _handleTap(details.localPosition, square),
          child: Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(painter: BoardPainter()),
              ),
              ..._pieces.map((piece) => _buildPiece(piece, square)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPiece(ChessPiece piece, double square) {
    final spec = kAnimationMap[piece.anim] ?? kAnimationMap[PieceAnim.idle]!;
    final isSelected = piece.id == _selectedPieceId;

    return AnimatedPositioned(
      duration: spec.duration,
      curve: spec.curve,
      left: piece.col * square,
      top: piece.row * square,
      width: square,
      height: square,
      child: AnimatedScale(
        duration: spec.duration,
        curve: spec.curve,
        scale: spec.scale,
        child: AnimatedContainer(
          duration: spec.duration,
          curve: spec.curve,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(square * 0.2),
            border: isSelected ? Border.all(color: Colors.amberAccent, width: 2) : null,
            boxShadow: spec.glow == null
                ? null
                : [
                    BoxShadow(
                      color: spec.glow!.withOpacity(0.45),
                      blurRadius: 10,
                      spreadRadius: 1,
                    ),
                  ],
          ),
          child: Center(
            child: Transform.translate(
              offset: spec.shake ? const Offset(2, 0) : Offset.zero,
              child: Text(
                piece.icon,
                style: TextStyle(
                  fontSize: square * 0.68,
                  height: 1,
                  color: piece.color == PieceColor.white ? Colors.white : Colors.black,
                  shadows: const [
                    Shadow(color: Colors.black54, blurRadius: 1.2, offset: Offset(0.5, 1)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _handleTap(Offset local, double square) {
    final tapped = _boardFromLocal(local, square);
    final tappedPiece = _pieceAt(tapped.$1, tapped.$2);

    if (_selectedPieceId == null) {
      if (tappedPiece == null) return;
      setState(() {
        _selectedPieceId = tappedPiece.id;
        tappedPiece.anim = PieceAnim.selected;
      });
      return;
    }

    final selected = _pieces.firstWhere((piece) => piece.id == _selectedPieceId);
    if (tappedPiece != null && tappedPiece.id == selected.id) {
      setState(() {
        selected.anim = PieceAnim.idle;
        _selectedPieceId = null;
      });
      return;
    }

    setState(() {
      selected.anim = tappedPiece == null ? PieceAnim.move : PieceAnim.capture;
      if (tappedPiece != null) {
        _pieces.removeWhere((piece) => piece.id == tappedPiece.id);
      }
      selected
        ..row = tapped.$1
        ..col = tapped.$2;
      _selectedPieceId = null;
    });

    Future<void>.delayed(kAnimationMap[selected.anim]!.duration, () {
      if (!mounted) return;
      final resetTarget = _pieceById(selected.id);
      if (resetTarget == null) return;
      setState(() => resetTarget.anim = PieceAnim.idle);
    });
  }

  ChessPiece? _pieceById(String id) {
    for (final piece in _pieces) {
      if (piece.id == id) return piece;
    }
    return null;
  }

  ChessPiece? _pieceAt(int row, int col) {
    for (final piece in _pieces) {
      if (piece.row == row && piece.col == col) return piece;
    }
    return null;
  }

  (int, int) _boardFromLocal(Offset local, double square) {
    final rawCol = (local.dx / square).floor();
    final rawRow = (local.dy / square).floor();
    final col = rawCol.clamp(0, _boardSize - 1);
    final row = rawRow.clamp(0, _boardSize - 1);
    return (row, col);
  }

  static List<ChessPiece> _initialPieces() {
    final pieces = <ChessPiece>[];

    const backRank = [
      PieceType.rook,
      PieceType.knight,
      PieceType.bishop,
      PieceType.queen,
      PieceType.king,
      PieceType.bishop,
      PieceType.knight,
      PieceType.rook,
    ];

    for (var col = 0; col < _boardSize; col++) {
      pieces
        ..add(ChessPiece(
          id: 'w_back_$col',
          color: PieceColor.white,
          type: backRank[col],
          row: 7,
          col: col,
        ))
        ..add(ChessPiece(
          id: 'w_pawn_$col',
          color: PieceColor.white,
          type: PieceType.pawn,
          row: 6,
          col: col,
        ))
        ..add(ChessPiece(
          id: 'b_back_$col',
          color: PieceColor.black,
          type: backRank[col],
          row: 0,
          col: col,
        ))
        ..add(ChessPiece(
          id: 'b_pawn_$col',
          color: PieceColor.black,
          type: PieceType.pawn,
          row: 1,
          col: col,
        ));
    }

    return pieces;
  }
}

class BoardPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final light = Paint()..color = const Color(0xfff0d9b5);
    final dark = Paint()..color = const Color(0xffb58863);

    final squareSize = size.width / 8;
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        final isLight = (row + col) % 2 == 0;
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
