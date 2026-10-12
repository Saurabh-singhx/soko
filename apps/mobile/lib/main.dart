import 'package:flutter/material.dart';
import 'core/theme/glass_theme.dart';
import 'services/bluetooth/ble_service.dart';
import 'ui/screens/home_dashboard_screen.dart';
import 'ui/screens/terminal_remote_screen.dart';
import 'ui/screens/file_share_screen.dart';
import 'ui/screens/pairing_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SokoMobileApp());
}

/// Root Application Widget for Soko Mobile.
class SokoMobileApp extends StatefulWidget {
  const SokoMobileApp({super.key});

  @override
  State<SokoMobileApp> createState() => _SokoMobileAppState();
}

class _SokoMobileAppState extends State<SokoMobileApp> {
  final MobileBleService bleService = MobileBleService();
  int _currentIndex = 0;

  @override
  void dispose() {
    bleService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Soko Companion',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: GlassTheme.bgDark,
        colorScheme: const ColorScheme.dark(
          primary: GlassTheme.cyanAccent,
          secondary: GlassTheme.purpleAccent,
          surface: GlassTheme.bgElevated,
        ),
      ),
      home: Scaffold(
        body: IndexedStack(
          index: _currentIndex,
          children: [
            HomeDashboardScreen(
              bleService: bleService,
              onOpenTerminal: () => setState(() => _currentIndex = 1),
              onOpenFileShare: () => setState(() => _currentIndex = 2),
              onOpenPairing: () => setState(() => _currentIndex = 3),
            ),
            TerminalRemoteScreen(
              onBack: () => setState(() => _currentIndex = 0),
            ),
            FileShareScreen(
              onBack: () => setState(() => _currentIndex = 0),
            ),
            PairingScreen(
              bleService: bleService,
              onBack: () => setState(() => _currentIndex = 0),
            ),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) => setState(() => _currentIndex = index),
          backgroundColor: const Color(0xFF0F0F16),
          indicatorColor: GlassTheme.cyanAccent.withOpacity(0.2),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard, color: GlassTheme.cyanAccent),
              label: 'Hub',
            ),
            NavigationDestination(
              icon: Icon(Icons.terminal_outlined),
              selectedIcon: Icon(Icons.terminal, color: GlassTheme.cyanAccent),
              label: 'CLI Terminal',
            ),
            NavigationDestination(
              icon: Icon(Icons.bolt_outlined),
              selectedIcon: Icon(Icons.bolt, color: GlassTheme.cyanAccent),
              label: 'Fast Share',
            ),
            NavigationDestination(
              icon: Icon(Icons.bluetooth_outlined),
              selectedIcon: Icon(Icons.bluetooth, color: GlassTheme.cyanAccent),
              label: 'Pairing',
            ),
          ],
        ),
      ),
    );
  }
}
