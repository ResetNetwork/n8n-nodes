{
  description = "A Nix-flake-based Node.js development environment";

  inputs.nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.1";

  outputs = inputs:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSupportedSystem = f: inputs.nixpkgs.lib.genAttrs supportedSystems (system: f {
        pkgs = import inputs.nixpkgs {
          inherit system;
          overlays = [ inputs.self.overlays.default ];
          config = {
            allowUnfree = true;
          };
        };
      });
    in
    {
      overlays.default = final: prev: rec {
        nodejs = prev.nodejs;
      };

      devShells = forEachSupportedSystem ({ pkgs }: {
        default = pkgs.mkShell {
          packages = with pkgs; [ nodejs n8n ];
          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
          '';
        };
      });
    };
}
