import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/glass_theme.dart';

/// Reusable Glassmorphic Card widget featuring backdrop blur and frosted gradient border.
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final double opacity;
  final Color? borderColor;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20.0),
    this.borderRadius = GlassTheme.cardBorderRadius,
    this.opacity = 0.08,
    this.borderColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: GlassTheme.defaultBlurSigma,
          sigmaY: GlassTheme.defaultBlurSigma,
        ),
        child: Container(
          padding: padding,
          decoration: GlassTheme.glassBoxDecoration(
            opacity: opacity,
            borderRadius: borderRadius,
            borderColor: borderColor ?? Colors.white,
          ),
          child: child,
        ),
      ),
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: card,
      );
    }

    return card;
  }
}
